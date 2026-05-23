# VOLSCAN — Implied Volatility Surface Globe

Interactive globe for exploring implied volatility surfaces of global equity index ETFs.

## Stack
- **Backend**: Python + aiohttp (REST API, Black-Scholes Newton-Raphson IV solver)
- **Frontend**: React + Three.js (3D globe) + Plotly (3D IV surface)

## Setup

### 1. Backend
```bash
cd backend
pip install -r requirements.txt
python serve_all.py
```

### 2. Frontend (dev mode)
```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
```

### 3. Production (single server)
```bash
cd frontend
npm install --legacy-peer-deps
npm run build

cd ..
python backend/serve_all.py
# Open http://localhost:8765
```

## How it works
1. Click any glowing dot on the globe (or pick from the sidebar list)
2. The backend fetches live options chains via `yfinance`
3. Each option's market price is fed into a **Black-Scholes Newton-Raphson** IV solver
4. The resulting IVs are plotted as a 3D surface (Moneyness × Days-to-Expiry × IV%)

## Markets supported
SPY (US), EWU (UK), EWG (Germany), EWJ (Japan), EWC (Canada), EWQ (France),
EWA (Australia), EWY (South Korea), EWZ (Brazil), FXI (China), INDA (India),
EWW (Mexico), EWI (Italy), EWP (Spain), EWL (Switzerland), EWN (Netherlands),
EWD (Sweden), EWT (Taiwan), EWH (Hong Kong), EWS (Singapore), EZA (South Africa), RSX (Russia)

## Notes
- Markets must be open (or recently closed) for options data to be available
- The IV solver uses risk-free rate r=4.5% (US 3-month T-bill proxy)
- Strikes filtered to 0.75–1.25 moneyness range for clean vol smile visualization
