"""
Serves both the React build (static) and the API from one aiohttp server on port 8765.
"""
import asyncio, json, math, logging
from datetime import datetime, date
from pathlib import Path
from typing import Optional

import numpy as np
import yfinance as yf
from aiohttp import web
from scipy.stats import norm

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

COUNTRY_INDEX_MAP = {
    "United States":    {"ticker": "SPY",   "name": "S&P 500 ETF",          "currency": "USD"},
    "United Kingdom":   {"ticker": "EWU",   "name": "MSCI UK ETF",           "currency": "GBP"},
    "Germany":          {"ticker": "EWG",   "name": "MSCI Germany ETF",      "currency": "EUR"},
    "Japan":            {"ticker": "EWJ",   "name": "MSCI Japan ETF",        "currency": "JPY"},
    "Canada":           {"ticker": "EWC",   "name": "MSCI Canada ETF",       "currency": "CAD"},
    "France":           {"ticker": "EWQ",   "name": "MSCI France ETF",       "currency": "EUR"},
    "Australia":        {"ticker": "EWA",   "name": "MSCI Australia ETF",    "currency": "AUD"},
    "South Korea":      {"ticker": "EWY",   "name": "MSCI South Korea ETF",  "currency": "KRW"},
    "Brazil":           {"ticker": "EWZ",   "name": "MSCI Brazil ETF",       "currency": "BRL"},
    "China":            {"ticker": "FXI",   "name": "China Large-Cap ETF",   "currency": "USD"},
    "India":            {"ticker": "INDA",  "name": "MSCI India ETF",        "currency": "USD"},
    "Mexico":           {"ticker": "EWW",   "name": "MSCI Mexico ETF",       "currency": "MXN"},
    "Italy":            {"ticker": "EWI",   "name": "MSCI Italy ETF",        "currency": "EUR"},
    "Spain":            {"ticker": "EWP",   "name": "MSCI Spain ETF",        "currency": "EUR"},
    "Switzerland":      {"ticker": "EWL",   "name": "MSCI Switzerland ETF",  "currency": "CHF"},
    "Netherlands":      {"ticker": "EWN",   "name": "MSCI Netherlands ETF",  "currency": "EUR"},
    "Sweden":           {"ticker": "EWD",   "name": "MSCI Sweden ETF",       "currency": "SEK"},
    "Taiwan":           {"ticker": "EWT",   "name": "MSCI Taiwan ETF",       "currency": "TWD"},
    "Hong Kong":        {"ticker": "EWH",   "name": "MSCI Hong Kong ETF",    "currency": "HKD"},
    "Singapore":        {"ticker": "EWS",   "name": "MSCI Singapore ETF",    "currency": "SGD"},
    "South Africa":     {"ticker": "EZA",   "name": "MSCI South Africa ETF", "currency": "ZAR"},
    "Russia":           {"ticker": "RSX",   "name": "Russia ETF",            "currency": "USD"},
}

def bs_call_price(S, K, T, r, sigma):
    if T<=0 or sigma<=0: return max(S-K, 0.0)
    d1=(math.log(S/K)+(r+0.5*sigma**2)*T)/(sigma*math.sqrt(T))
    d2=d1-sigma*math.sqrt(T)
    return S*norm.cdf(d1)-K*math.exp(-r*T)*norm.cdf(d2)

def bs_put_price(S, K, T, r, sigma):
    if T<=0 or sigma<=0: return max(K-S, 0.0)
    d1=(math.log(S/K)+(r+0.5*sigma**2)*T)/(sigma*math.sqrt(T))
    d2=d1-sigma*math.sqrt(T)
    return K*math.exp(-r*T)*norm.cdf(-d2)-S*norm.cdf(-d1)

def bs_vega(S, K, T, r, sigma):
    if T<=0 or sigma<=0: return 1e-8
    d1=(math.log(S/K)+(r+0.5*sigma**2)*T)/(sigma*math.sqrt(T))
    return S*norm.pdf(d1)*math.sqrt(T)

def implied_vol_newton(market_price, S, K, T, r=0.045, option_type="call",
                        max_iter=100, tol=1e-6):
    if T<=0 or market_price<=0: return None
    if option_type=="call":
        intrinsic=max(S-K*math.exp(-r*T),0)
    else:
        intrinsic=max(K*math.exp(-r*T)-S,0)
    if market_price < intrinsic-0.01: return None
    sigma=0.3
    for _ in range(max_iter):
        price=bs_call_price(S,K,T,r,sigma) if option_type=="call" else bs_put_price(S,K,T,r,sigma)
        diff=price-market_price
        vega=bs_vega(S,K,T,r,sigma)
        if abs(vega)<1e-10: break
        sigma_new=sigma-diff/vega
        if sigma_new<=0: sigma=sigma/2; continue
        if abs(sigma_new-sigma)<tol: sigma=sigma_new; break
        sigma=sigma_new
    return sigma if 0.001<sigma<20.0 else None

async def compute_iv_surface(ticker_sym):
    loop=asyncio.get_event_loop()
    def _fetch():
        tk=yf.Ticker(ticker_sym)
        sd=tk.history(period="1d")
        if sd.empty: raise ValueError(f"No price data for {ticker_sym}")
        S=float(sd["Close"].iloc[-1])
        return tk, S, tk.options
    tk,S,expirations=await loop.run_in_executor(None,_fetch)
    if not expirations: raise ValueError("No options chain available")
    today=date.today()
    surface_points=[]
    for exp_str in expirations[:8]:
        exp_date=datetime.strptime(exp_str,"%Y-%m-%d").date()
        T=(exp_date-today).days/365.0
        if T<5/365: continue
        def _get_chain(exp=exp_str):
            chain=tk.option_chain(exp)
            return chain.calls, chain.puts
        calls_df,puts_df=await loop.run_in_executor(None,_get_chain)
        for df,opt_type in [(calls_df,"call"),(puts_df,"put")]:
            df=df.copy()
            df=df[(df["strike"]>0)&(df["lastPrice"]>0.05)]
            df["moneyness"]=df["strike"]/S
            df=df[(df["moneyness"]>=0.75)&(df["moneyness"]<=1.25)]
            for _,row in df.iterrows():
                mid=row["lastPrice"]
                if row.get("bid",0)>0 and row.get("ask",0)>0:
                    mid=(row["bid"]+row["ask"])/2
                iv=implied_vol_newton(mid,S,float(row["strike"]),T,option_type=opt_type)
                if iv is not None:
                    surface_points.append({
                        "T":round(T,4),"moneyness":round(float(row["moneyness"]),4),
                        "iv":round(iv*100,2),"strike":round(float(row["strike"]),2),
                        "expiry":exp_str,"type":opt_type,
                    })
    if not surface_points: raise ValueError("Could not compute IV for any option")
    seen=set(); unique_pts=[]
    for p in surface_points:
        key=(p["T"],p["moneyness"])
        if key not in seen: seen.add(key); unique_pts.append(p)
    unique_pts.sort(key=lambda x:(x["T"],x["moneyness"]))
    return {"ticker":ticker_sym,"spot":round(S,2),"points":unique_pts,
            "computed_at":datetime.utcnow().isoformat()+"Z"}

@web.middleware
async def cors_mw(request, handler):
    if request.method=="OPTIONS":
        resp=web.Response()
    else:
        resp=await handler(request)
    resp.headers["Access-Control-Allow-Origin"]="*"
    resp.headers["Access-Control-Allow-Methods"]="GET,OPTIONS"
    resp.headers["Access-Control-Allow-Headers"]="Content-Type"
    return resp

async def handle_countries(req):
    return web.json_response({c:{"ticker":i["ticker"],"name":i["name"],"currency":i["currency"]}
                               for c,i in COUNTRY_INDEX_MAP.items()})

async def handle_iv(req):
    country=req.match_info["country"]
    if country not in COUNTRY_INDEX_MAP:
        return web.json_response({"error":f"'{country}' not supported"},status=404)
    ticker=COUNTRY_INDEX_MAP[country]["ticker"]
    logger.info(f"IV surface: {country} ({ticker})")
    try:
        result=await compute_iv_surface(ticker)
        result["country"]=country
        result["index_name"]=COUNTRY_INDEX_MAP[country]["name"]
        return web.json_response(result)
    except Exception as e:
        logger.error(f"Error: {e}")
        return web.json_response({"error":str(e)},status=500)

DIST = Path(__file__).parent.parent / "frontend" / "dist"

async def handle_static(req):
    path = req.match_info.get("path","")
    file = DIST / path if path else DIST / "index.html"
    if not file.exists() or not str(file.resolve()).startswith(str(DIST.resolve())):
        file = DIST / "index.html"
    return web.FileResponse(file)

def create_app():
    app=web.Application(middlewares=[cors_mw])
    app.router.add_get("/health", lambda r: web.json_response({"ok":True}))
    app.router.add_get("/api/countries", handle_countries)
    app.router.add_get("/api/iv-surface/{country}", handle_iv)
    app.router.add_get("/assets/{path:.*}", handle_static)
    app.router.add_get("/{path:.*}", handle_static)
    return app

if __name__=="__main__":
    logger.info("VOLSCAN starting on http://localhost:8765")
    web.run_app(create_app(), host="0.0.0.0", port=8765)
