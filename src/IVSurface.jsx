import { useMemo } from 'react'
import Plot from 'react-plotly.js'

function interpolateSurface(points) {
  // Extract unique T and moneyness values for the grid
  const Ts = [...new Set(points.map(p => p.T))].sort((a, b) => a - b)
  const Ms = [...new Set(points.map(p => p.moneyness))].sort((a, b) => a - b)

  // Build lookup
  const lookup = {}
  for (const p of points) {
    lookup[`${p.T}_${p.moneyness}`] = p.iv
  }

  // Build grid with nearest-neighbor fill for missing cells
  const zGrid = Ts.map(t => {
    return Ms.map(m => {
      const key = `${t}_${m}`
      if (lookup[key] !== undefined) return lookup[key]

      // Find nearest points
      let bestDist = Infinity, bestVal = null
      for (const p of points) {
        const dt = (p.T - t) / 0.5
        const dm = (p.moneyness - m) / 0.1
        const dist = Math.sqrt(dt * dt + dm * dm)
        if (dist < bestDist) {
          bestDist = dist
          bestVal = p.iv
        }
      }
      return bestVal || 25
    })
  })

  return { Ts, Ms, zGrid }
}

export default function IVSurface({ data }) {
  const { ticker, spot, points, country, index_name, computed_at } = data

  const { Ts, Ms, zGrid } = useMemo(() => interpolateSurface(points), [points])

  // Stats
  const ivValues = points.map(p => p.iv)
  const minIV = Math.min(...ivValues).toFixed(1)
  const maxIV = Math.max(...ivValues).toFixed(1)
  const atmIV = useMemo(() => {
    // Find closest to ATM (moneyness=1) at shortest expiry
    const atm = points.reduce((best, p) => {
      const score = Math.abs(p.moneyness - 1) + Math.abs(p.T - Ts[0])
      const bScore = Math.abs(best.moneyness - 1) + Math.abs(best.T - Ts[0])
      return score < bScore ? p : best
    }, points[0])
    return atm?.iv.toFixed(1)
  }, [points, Ts])

  const plotData = [{
    type: 'surface',
    x: Ms,
    y: Ts.map(t => +(t * 365).toFixed(0)),  // days to expiry
    z: zGrid,
    colorscale: [
      [0,    'rgb(0, 20, 60)'],
      [0.1,  'rgb(0, 50, 120)'],
      [0.25, 'rgb(0, 120, 180)'],
      [0.4,  'rgb(0, 200, 200)'],
      [0.55, 'rgb(0, 255, 180)'],
      [0.7,  'rgb(120, 255, 80)'],
      [0.85, 'rgb(255, 200, 0)'],
      [1.0,  'rgb(255, 80, 0)'],
    ],
    showscale: true,
    colorbar: {
      title: { text: 'IV %', font: { color: '#3a6070', family: 'Space Mono', size: 10 } },
      tickfont: { color: '#3a6070', family: 'Space Mono', size: 9 },
      thickness: 12,
      len: 0.6,
    },
    contours: {
      z: { show: true, usecolormap: true, highlightcolor: '#00ffe0', project: { z: true } }
    },
    opacity: 0.92,
    hovertemplate:
      'Moneyness: %{x:.3f}<br>Expiry: %{y}d<br>IV: %{z:.1f}%<extra></extra>',
  }]

  // Scatter points overlay
  const scatterData = [{
    type: 'scatter3d',
    x: points.map(p => p.moneyness),
    y: points.map(p => +(p.T * 365).toFixed(0)),
    z: points.map(p => p.iv),
    mode: 'markers',
    marker: {
      size: 2.5,
      color: points.map(p => p.iv),
      colorscale: [
        [0, 'rgb(0,255,224)'],
        [1, 'rgb(255,107,53)'],
      ],
      opacity: 0.7,
    },
    hovertemplate:
      '%{text}<br>K: %{customdata[0]}<br>Expiry: %{customdata[1]}<br>IV: %{z:.1f}%<extra></extra>',
    text: points.map(p => p.type.toUpperCase()),
    customdata: points.map(p => [p.strike, p.expiry]),
  }]

  const layout = {
    paper_bgcolor: '#060d14',
    plot_bgcolor: '#060d14',
    font: { family: 'Space Mono', color: '#3a6070', size: 10 },
    margin: { l: 0, r: 0, t: 30, b: 0 },
    scene: {
      bgcolor: '#020408',
      xaxis: {
        title: { text: 'Moneyness (K/S)', font: { color: '#3a6070', size: 9 } },
        gridcolor: '#0f2a3f',
        zerolinecolor: '#0f2a3f',
        tickfont: { color: '#3a6070', size: 8 },
        range: [Math.min(...Ms) - 0.02, Math.max(...Ms) + 0.02],
      },
      yaxis: {
        title: { text: 'Days to Expiry', font: { color: '#3a6070', size: 9 } },
        gridcolor: '#0f2a3f',
        zerolinecolor: '#0f2a3f',
        tickfont: { color: '#3a6070', size: 8 },
      },
      zaxis: {
        title: { text: 'Implied Vol (%)', font: { color: '#3a6070', size: 9 } },
        gridcolor: '#0f2a3f',
        zerolinecolor: '#0f2a3f',
        tickfont: { color: '#3a6070', size: 8 },
      },
      camera: { eye: { x: 1.6, y: -1.6, z: 1.2 } },
    },
    showlegend: false,
    title: {
      text: '',
    },
  }

  const computedDate = computed_at
    ? new Date(computed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : ''

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* IV Panel Header */}
      <div style={{
        padding: '12px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--accent)', letterSpacing: 3 }}>
            {index_name}
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
            {country?.toUpperCase()} · {ticker} · SPOT {spot?.toLocaleString()}
          </div>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 20 }}>
          {[
            ['ATM IV', `${atmIV}%`],
            ['MIN IV', `${minIV}%`],
            ['MAX IV', `${maxIV}%`],
            ['POINTS', points.length],
          ].map(([label, val]) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: 1 }}>{label}</div>
              <div style={{ fontSize: 16, color: 'var(--accent)', fontFamily: 'var(--font-display)', letterSpacing: 2 }}>
                {val}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Vol surface label */}
      <div style={{
        padding: '8px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 9, letterSpacing: 2, color: 'var(--muted)' }}>
          BLACK-SCHOLES NEWTON-RAPHSON · CALL/PUT CONSENSUS
        </span>
        <span style={{ fontSize: 9, color: 'var(--muted)' }}>
          COMPUTED AT {computedDate} UTC
        </span>
      </div>

      {/* 3D Plot */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <Plot
          data={[...plotData, ...scatterData]}
          layout={layout}
          config={{
            displayModeBar: true,
            modeBarButtonsToRemove: ['toImage', 'sendDataToCloud'],
            displaylogo: false,
            responsive: true,
          }}
          style={{ width: '100%', height: '100%' }}
          useResizeHandler
        />
      </div>

      {/* Smile legend */}
      <div style={{
        padding: '8px 20px',
        borderTop: '1px solid var(--border)',
        display: 'flex', gap: 20,
        fontSize: 9, color: 'var(--muted)',
      }}>
        <span style={{ color: '#00ffe0' }}>◈ PUT IV</span>
        <span style={{ color: '#ff6b35' }}>◈ CALL IV</span>
        <span style={{ marginLeft: 'auto' }}>
          DRAG TO ROTATE · SCROLL TO ZOOM · HOVER FOR VALUES
        </span>
      </div>
    </div>
  )
}
