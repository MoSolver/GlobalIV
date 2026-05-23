import { useRef, useState, useEffect, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stars } from '@react-three/drei'
import * as THREE from 'three'

// Country lat/lon centroids
const COUNTRY_COORDS = {
  "United States":   { lat: 38,    lon: -97   },
  "United Kingdom":  { lat: 54,    lon: -2    },
  "Germany":         { lat: 51,    lon: 10    },
  "Japan":           { lat: 36,    lon: 138   },
  "Canada":          { lat: 56,    lon: -106  },
  "France":          { lat: 46,    lon: 2     },
  "Australia":       { lat: -25,   lon: 133   },
  "South Korea":     { lat: 36,    lon: 128   },
  "Brazil":          { lat: -14,   lon: -51   },
  "China":           { lat: 35,    lon: 105   },
  "India":           { lat: 20,    lon: 77    },
  "Mexico":          { lat: 23,    lon: -102  },
  "Italy":           { lat: 42,    lon: 12    },
  "Spain":           { lat: 40,    lon: -4    },
  "Switzerland":     { lat: 47,    lon: 8     },
  "Netherlands":     { lat: 52,    lon: 5     },
  "Sweden":          { lat: 62,    lon: 17    },
  "Taiwan":          { lat: 23.5,  lon: 121   },
  "Hong Kong":       { lat: 22.3,  lon: 114   },
  "Singapore":       { lat: 1.3,   lon: 103.8 },
  "South Africa":    { lat: -29,   lon: 25    },
  "Russia":          { lat: 61,    lon: 105   },
}

function latLonToVec3(lat, lon, r = 1) {
  const phi   = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta)
  )
}

function CountryMarker({ name, lat, lon, isSelected, isHovered, onClick, onHover }) {
  const meshRef = useRef()
  const glowRef = useRef()
  const pos = useMemo(() => latLonToVec3(lat, lon, 1.02), [lat, lon])

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.lookAt(0, 0, 0)
      const t = state.clock.elapsedTime
      if (isSelected) {
        meshRef.current.scale.setScalar(1 + 0.3 * Math.sin(t * 4))
      } else if (isHovered) {
        meshRef.current.scale.setScalar(1.4)
      } else {
        meshRef.current.scale.setScalar(1)
      }
    }
  })

  const color = isSelected ? '#ff6b35' : isHovered ? '#00ffe0' : '#00ffe0'
  const size = isSelected ? 0.025 : 0.018

  return (
    <group position={pos}>
      {/* Main dot */}
      <mesh
        ref={meshRef}
        onClick={(e) => { e.stopPropagation(); onClick(name) }}
        onPointerOver={(e) => { e.stopPropagation(); onHover(name) }}
        onPointerOut={(e) => { e.stopPropagation(); onHover(null) }}
      >
        <circleGeometry args={[size, 12]} />
        <meshBasicMaterial color={color} side={THREE.DoubleSide} />
      </mesh>

      {/* Glow ring */}
      {(isSelected || isHovered) && (
        <mesh ref={glowRef}>
          <ringGeometry args={[size * 1.5, size * 2.5, 16]} />
          <meshBasicMaterial color={color} transparent opacity={0.4} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  )
}

function Globe({ countries, selected, onSelect }) {
  const globeRef = useRef()
  const glowRef  = useRef()
  const [hovered, setHovered] = useState(null)

  useFrame((state) => {
    if (globeRef.current && !selected) {
      globeRef.current.rotation.y += 0.0008
    }
    if (glowRef.current) {
      glowRef.current.material.opacity = 0.04 + 0.02 * Math.sin(state.clock.elapsedTime)
    }
  })

  const earthTexture = useMemo(() => {
    return new THREE.TextureLoader().load(
      'https://unpkg.com/three-globe/example/img/earth-day.jpg'
    )
  }, [])

  const atmosphereTexture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256; canvas.height = 256
    const ctx = canvas.getContext('2d')
    const grad = ctx.createRadialGradient(128, 128, 80, 128, 128, 128)
    grad.addColorStop(0, 'rgba(0,80,120,0)')
    grad.addColorStop(0.7, 'rgba(0,80,120,0.1)')
    grad.addColorStop(1, 'rgba(0,200,255,0.25)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 256, 256)
    return new THREE.CanvasTexture(canvas)
  }, [])

  return (
    <group ref={globeRef}>
      {/* Core sphere */}
      <mesh>
        <sphereGeometry args={[1, 64, 64]} />
        <meshPhongMaterial
          map={earthTexture}
          specularMap={earthTexture}
          shininess={15}
        />
      </mesh>

      {/* Atmosphere glow */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[1.08, 32, 32]} />
        <meshBasicMaterial
          color="#00aaff"
          transparent
          opacity={0.05}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Outer atmosphere */}
      <mesh>
        <sphereGeometry args={[1.15, 32, 32]} />
        <meshBasicMaterial
          color="#003366"
          transparent
          opacity={0.03}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Country markers */}
      {Object.entries(COUNTRY_COORDS).map(([name, { lat, lon }]) =>
        countries[name] ? (
          <CountryMarker
            key={name}
            name={name}
            lat={lat}
            lon={lon}
            isSelected={selected === name}
            isHovered={hovered === name}
            onClick={onSelect}
            onHover={setHovered}
          />
        ) : null
      )}
    </group>
  )
}

function HoverLabel({ countries, hovered }) {
  if (!hovered || !countries[hovered]) return null
  const info = countries[hovered]
  return (
    <div style={{
      position: 'absolute', top: 16, left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(6,13,20,0.9)',
      border: '1px solid var(--accent)',
      padding: '6px 16px',
      fontSize: 11, color: 'var(--accent)',
      letterSpacing: 2,
      pointerEvents: 'none',
      backdropFilter: 'blur(4px)',
      whiteSpace: 'nowrap',
    }}>
      {hovered.toUpperCase()} · {info.ticker} · {info.currency}
    </div>
  )
}

export default function GlobeWrapper({ countries, selected, onSelect, loading }) {
  const [hoveredLabel, setHoveredLabel] = useState(null)

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', cursor: 'crosshair' }}>
      <Canvas
        camera={{ position: [0, 0, 2.8], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.2} />
        <directionalLight position={[5, 3, 5]} intensity={1.2} color="#ffffff" />
        <pointLight position={[-5, -3, -5]} intensity={0.3} color="#0066ff" />
        <pointLight position={[0, 5, 0]} intensity={0.2} color="#00ffcc" />

        {/* Stars */}
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={0.5} />

        <Globe
          countries={countries}
          selected={selected}
          onSelect={(name) => {
            setHoveredLabel(null)
            onSelect(name)
          }}
        />

        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minDistance={1.8}
          maxDistance={5}
          rotateSpeed={0.4}
          zoomSpeed={0.6}
          autoRotate={!selected}
          autoRotateSpeed={0.3}
        />
      </Canvas>

      {/* Overlay: country list */}
      <div style={{
        position: 'absolute', top: 16, right: 16,
        background: 'rgba(6,13,20,0.85)',
        border: '1px solid var(--border)',
        backdropFilter: 'blur(6px)',
        padding: '10px 14px',
        maxHeight: '80vh',
        overflowY: 'auto',
        fontSize: 10,
        color: 'var(--muted)',
      }}>
        <div style={{ color: 'var(--accent)', letterSpacing: 2, marginBottom: 8, fontSize: 9 }}>
          AVAILABLE MARKETS
        </div>
        {Object.entries(countries).map(([name, info]) => (
          <div
            key={name}
            onClick={() => onSelect(name)}
            style={{
              padding: '3px 0',
              cursor: 'pointer',
              color: selected === name ? 'var(--accent2)' : 'var(--muted)',
              borderLeft: selected === name ? '2px solid var(--accent2)' : '2px solid transparent',
              paddingLeft: 6,
              transition: 'all 0.15s',
              display: 'flex', justifyContent: 'space-between', gap: 12,
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
            onMouseLeave={e => e.currentTarget.style.color = selected === name ? 'var(--accent2)' : 'var(--muted)'}
          >
            <span>{name}</span>
            <span style={{ color: 'var(--accent)', opacity: 0.7 }}>{info.ticker}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
