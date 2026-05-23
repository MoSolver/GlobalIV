import { useState, useEffect } from 'react'
import Globe from './Globe'
import IVSurface from './IVSurface'

const API = 'http://localhost:8765'

export default function App() {
  const [countries, setCountries] = useState({})
  const [selected, setSelected] = useState(null)
  const [ivData, setIvData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [statusLog, setStatusLog] = useState(['> SYSTEM ONLINE', '> AWAITING TARGET SELECTION'])

  const log = (msg) => setStatusLog(prev => [...prev.slice(-6), `> ${msg}`])

  useEffect(() => {
    fetch(`${API}/api/countries`)
      .then(r => r.json())
      .then(data => {
        setCountries(data)
        log(`LOADED ${Object.keys(data).length} MARKETS`)
      })
      .catch(() => log('WARN: BACKEND OFFLINE — START server.py'))
  }, [])

  const handleCountryClick = async (countryName) => {
    if (!countries[countryName]) return
    setSelected(countryName)
    setIvData(null)
    setError(null)
    setLoading(true)
    log(`FETCHING ${countries[countryName].ticker} OPTIONS CHAIN`)

    try {
      const encoded = encodeURIComponent(countryName)
      const res = await fetch(`${API}/api/iv-surface/${encoded}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Unknown error')
      setIvData(data)
      log(`IV SURFACE COMPUTED — ${data.points?.length} POINTS`)
    } catch (e) {
      setError(e.message)
      log(`ERROR: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="scanline" />
      <div className="vignette" />

      {/* Header */}
      <header style={{
        height: 52, flexShrink: 0,
        background: 'var(--panel)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center',
        padding: '0 24px', gap: 24,
        position: 'relative', zIndex: 10,
      }}>
        <span style={{
          fontFamily: 'var(--font-display)', fontSize: 28,
          color: 'var(--accent)', letterSpacing: 4,
        }}>VOLSCAN</span>
        <span style={{ color: 'var(--muted)', fontSize: 11 }}>
          IMPLIED VOLATILITY SURFACE EXPLORER
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, alignItems: 'center' }}>
          {selected && countries[selected] && (
            <span style={{ color: 'var(--accent2)', fontSize: 12, fontWeight: 700 }}>
              [{countries[selected].ticker}] {selected.toUpperCase()}
            </span>
          )}
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: loading ? 'var(--warn)' : 'var(--accent)',
            boxShadow: loading ? '0 0 8px var(--warn)' : '0 0 8px var(--accent)',
            animation: loading ? 'pulse 0.5s ease infinite alternate' : 'none',
          }} />
        </div>
        <style>{`
          @keyframes pulse { from { opacity: 0.3; } to { opacity: 1; } }
        `}</style>
      </header>

      {/* Main layout */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* Globe panel */}
        <div style={{
          width: ivData ? '45%' : '100%',
          transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
          position: 'relative',
          borderRight: ivData ? '1px solid var(--border)' : 'none',
        }}>
          <Globe
            countries={countries}
            selected={selected}
            onSelect={handleCountryClick}
            loading={loading}
          />

          {/* Status log overlay */}
          <div style={{
            position: 'absolute', bottom: 16, left: 16, right: 16,
            background: 'rgba(6,13,20,0.85)',
            border: '1px solid var(--border)',
            padding: '8px 12px',
            fontSize: 10, color: 'var(--muted)',
            backdropFilter: 'blur(4px)',
            maxHeight: 100, overflowY: 'auto',
          }}>
            {statusLog.map((l, i) => (
              <div key={i} style={{
                color: l.includes('ERROR') ? '#ff4444' : l.includes('WARN') ? 'var(--warn)' : 'var(--muted)',
                fontFamily: 'var(--font-mono)',
              }}>{l}</div>
            ))}
          </div>

          {/* Instructions */}
          {!selected && (
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -130px)',
              textAlign: 'center', pointerEvents: 'none',
            }}>
              <div style={{
                fontFamily: 'var(--font-display)', fontSize: 42,
                color: 'rgba(0,255,224,0.08)', letterSpacing: 8,
                lineHeight: 1,
              }}>CLICK A NATION</div>
            </div>
          )}
        </div>

        {/* IV Surface panel */}
        {(ivData || loading || error) && (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            background: 'var(--panel)', overflow: 'hidden',
            position: 'relative',
          }}>
            <button
              onClick={() => { setIvData(null); setError(null); setSelected(null) }}
              style={{
                position: 'absolute', top: 10, right: 14, zIndex: 100,
                background: 'none', border: '1px solid var(--border)',
                color: 'var(--muted)', cursor: 'pointer',
                fontFamily: 'var(--font-mono)', fontSize: 16,
                width: 28, height: 28, lineHeight: '26px', textAlign: 'center',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent2)'; e.currentTarget.style.color = 'var(--accent2)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}
            >×</button>
            {loading && (
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 16,
              }}>
                <div style={{ position: 'relative', width: 80, height: 80 }}>
                  {[...Array(3)].map((_, i) => (
                    <div key={i} style={{
                      position: 'absolute', inset: i * 12,
                      border: '1px solid var(--accent)',
                      borderRadius: '50%',
                      opacity: 0.4 - i * 0.1,
                      animation: `spin${i} ${1.5 + i * 0.5}s linear infinite`,
                    }} />
                  ))}
                </div>
                <div style={{ color: 'var(--accent)', fontSize: 13, letterSpacing: 3 }}>
                  COMPUTING IV SURFACE
                </div>
                <div style={{ color: 'var(--muted)', fontSize: 10 }}>
                  {selected} — {countries[selected]?.ticker}
                </div>
                <style>{`
                  @keyframes spin0 { to { transform: rotate(360deg); } }
                  @keyframes spin1 { to { transform: rotate(-360deg); } }
                  @keyframes spin2 { to { transform: rotate(360deg); } }
                `}</style>
              </div>
            )}

            {error && !loading && (
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 12,
              }}>
                <div style={{ color: '#ff4444', fontSize: 13, letterSpacing: 2 }}>
                  ⚠ DATA UNAVAILABLE
                </div>
                <div style={{ color: 'var(--muted)', fontSize: 11, maxWidth: 320, textAlign: 'center' }}>
                  {error}
                </div>
                <div style={{ color: 'var(--muted)', fontSize: 10 }}>
                  Market may be closed or options illiquid
                </div>
              </div>
            )}

            {ivData && !loading && (
              <IVSurface data={ivData} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
