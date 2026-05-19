'use client'

import { useEffect, useRef, useState } from 'react'

type Urgency = 'calm' | 'busy' | 'urgent'

type MuralProps = {
  urgency: Urgency
}

// ── Color palettes — gradient stops mapped to escape iterations ─────────

const COLOR_MAPS: Record<Urgency, Array<[number, number, number]>> = {
  calm: [
    [232, 237, 232],
    [180, 210, 180],
    [120, 170, 130],
    [60, 130, 90],
    [30, 90, 60],
    [15, 60, 40],
    [232, 237, 232],
  ],
  busy: [
    [232, 232, 237],
    [200, 180, 220],
    [160, 120, 200],
    [120, 80, 180],
    [80, 50, 140],
    [50, 30, 100],
    [232, 232, 237],
  ],
  urgent: [
    [237, 232, 225],
    [220, 190, 150],
    [200, 140, 70],
    [180, 100, 40],
    [140, 70, 20],
    [80, 40, 10],
    [237, 232, 225],
  ],
}

// ── Interesting regions of the Mandelbrot set ───────────────────────────

const REGIONS = [
  { cx: -0.7435669, cy: 0.1314023, span: 0.0022 },
  { cx: -0.7473, cy: 0.1028, span: 0.005 },
  { cx: -0.16,   cy: 1.0405, span: 0.026 },
  { cx: -1.25066, cy: 0.02012, span: 0.0045 },
  { cx: -0.10109636384562, cy: 0.95628651080914, span: 0.00375 },
  { cx: 0.281717921930775, cy: 0.5771052841488505, span: 0.003 },
  { cx: -1.7497591451303785, cy: 0.0, span: 0.0065 },
  { cx: -0.5615, cy: 0.6426, span: 0.012 },
  { cx: -0.4319, cy: 0.6065, span: 0.018 },
  { cx: 0.3580, cy: 0.6436, span: 0.005 },
  { cx: -0.194, cy: 0.6557, span: 0.008 },
  { cx: -1.985424253345, cy: -0.0000006, span: 0.00000065 },
]

// ── Mandelbrot computation ──────────────────────────────────────────────

const MAX_ITER = 256

function mandelbrotEscape(cr: number, ci: number): number {
  let zr = 0, zi = 0
  for (let i = 0; i < MAX_ITER; i++) {
    const zr2 = zr * zr
    const zi2 = zi * zi
    if (zr2 + zi2 > 4) return i + 1 - Math.log2(Math.log2(zr2 + zi2))
    zi = 2 * zr * zi + ci
    zr = zr2 - zi2 + cr
  }
  return -1
}

function iterToColor(
  iter: number,
  map: Array<[number, number, number]>,
  shift: number,
): [number, number, number, number] {
  if (iter < 0) return [0, 0, 0, 0]

  const t = ((iter + shift) % 32) / 32
  const idx = t * (map.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.min(lo + 1, map.length - 1)
  const f = idx - lo

  return [
    Math.round(map[lo][0] + (map[hi][0] - map[lo][0]) * f),
    Math.round(map[lo][1] + (map[hi][1] - map[lo][1]) * f),
    Math.round(map[lo][2] + (map[hi][2] - map[lo][2]) * f),
    255,
  ]
}

// ── Render a full frame at given zoom level ─────────────────────────────

function renderFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  region: { cx: number; cy: number; span: number },
  zoom: number,
  colorShift: number,
  map: Array<[number, number, number]>,
  step: number,
) {
  const span = region.span / zoom
  const aspect = w / h
  const spanX = span * aspect
  const spanY = span
  const xMin = region.cx - spanX / 2
  const yMin = region.cy - spanY / 2

  const imageData = ctx.createImageData(w, h)
  const data = imageData.data

  for (let py = 0; py < h; py += step) {
    for (let px = 0; px < w; px += step) {
      const cr = xMin + (px / w) * spanX
      const ci = yMin + (py / h) * spanY
      const iter = mandelbrotEscape(cr, ci)
      const [r, g, b, a] = iterToColor(iter, map, colorShift)

      for (let dy = 0; dy < step && py + dy < h; dy++) {
        for (let dx = 0; dx < step && px + dx < w; dx++) {
          const idx = ((py + dy) * w + (px + dx)) * 4
          data[idx] = r
          data[idx + 1] = g
          data[idx + 2] = b
          data[idx + 3] = a
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0)
}

// ── Component ───────────────────────────────────────────────────────────

const ZOOM_SPEED: Record<Urgency, number> = {
  calm: 0.000125,
  busy: 0.00025,
  urgent: 0.0005,
}

const COLOR_SHIFT_SPEED: Record<Urgency, number> = {
  calm: 0.00125,
  busy: 0.003,
  urgent: 0.005,
}

export default function MuralCanvas({ urgency }: MuralProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const urgencyRef = useRef(urgency)
  urgencyRef.current = urgency
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const fullW = window.innerWidth
    const fullH = window.innerHeight
    const w = Math.floor(fullW / 4)
    const h = Math.floor(fullH / 4)
    canvas.width = w
    canvas.height = h
    canvas.style.width = `${fullW}px`
    canvas.style.height = `${fullH}px`

    const region = REGIONS[Math.floor(Math.random() * REGIONS.length)]

    let zoom = 1
    let colorShift = 0
    let cancelled = false

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)')

    renderFrame(ctx, w, h, region, zoom, colorShift, COLOR_MAPS[urgencyRef.current], 1)

    // Fade in after first frame
    requestAnimationFrame(() => setVisible(true))

    // Evolve shape on a slow cadence
    const MAX_ZOOM = 1e8

    function evolve() {
      if (cancelled) return
      if (!prefersReduced.matches) {
        const u = urgencyRef.current
        if (zoom < MAX_ZOOM) zoom *= (1 + ZOOM_SPEED[u])
        colorShift += COLOR_SHIFT_SPEED[u]
        renderFrame(ctx!, w, h, region, zoom, colorShift, COLOR_MAPS[u], 1)
      }
      setTimeout(evolve, 4000)
    }

    setTimeout(evolve, 4000)

    return () => { cancelled = true }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 0,
        pointerEvents: 'none',
        imageRendering: 'auto',
        opacity: visible ? 0.22 : 0,
        transition: 'opacity 5s ease-in-out',
      }}
    />
  )
}
