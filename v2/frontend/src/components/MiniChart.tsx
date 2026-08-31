interface Point {
  label: string
  value: number
}

/**
 * A line over time, drawn as an inline SVG.
 *
 * No chart library: this is one polyline and some labels, and a dependency for
 * it would outweigh the whole page it sits on. The curve is smoothed with cubic
 * segments so a sparse series reads as a trend rather than a zig-zag.
 */
export default function MiniChart({ points, height = 180 }: { points: Point[]; height?: number }) {
  if (points.length === 0) {
    return <p className="muted small">Belum ada meeting untuk ditampilkan.</p>
  }

  const width = 640
  const pad = { top: 18, right: 12, bottom: 26, left: 30 }
  const w = width - pad.left - pad.right
  const h = height - pad.top - pad.bottom
  // Never divide by zero, and never draw a flat line at the very top: a series
  // of equal values should sit mid-height, not pinned to the ceiling.
  const max = Math.max(...points.map(p => p.value), 1)

  const coords = points.map((p, i) => ({
    ...p,
    x: pad.left + (points.length === 1 ? w / 2 : (i / (points.length - 1)) * w),
    y: pad.top + h - (p.value / max) * h,
  }))

  const path = coords.reduce((acc, p, i, all) => {
    if (i === 0) return `M ${p.x} ${p.y}`
    const prev = all[i - 1]
    const cx = (p.x - prev.x) * 0.48
    return `${acc} C ${prev.x + cx} ${prev.y}, ${p.x - cx} ${p.y}, ${p.x} ${p.y}`
  }, '')

  const area = `${path} L ${coords[coords.length - 1].x} ${pad.top + h} L ${coords[0].x} ${pad.top + h} Z`

  // Every label would overlap on a long series, so only a few are drawn.
  const step = Math.ceil(coords.length / 8)

  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img"
         aria-label={`Tren visitor per meeting, ${points.length} titik`}>
      {[0, 0.5, 1].map(t => (
        <line key={t} className="chart__grid"
              x1={pad.left} x2={width - pad.right}
              y1={pad.top + h * t} y2={pad.top + h * t} />
      ))}
      {[max, Math.round(max / 2), 0].map((v, i) => (
        <text key={v} className="chart__axis" x={pad.left - 6} y={pad.top + h * (i / 2) + 4} textAnchor="end">{v}</text>
      ))}

      <path className="chart__area" d={area} />
      <path className="chart__line" d={path} />

      {coords.map((p, i) => (
        <g key={p.label + i}>
          <circle className="chart__dot" cx={p.x} cy={p.y} r={3.5} />
          <text className="chart__value" x={p.x} y={p.y - 9} textAnchor="middle">{p.value}</text>
          {i % step === 0 && (
            <text className="chart__axis" x={p.x} y={height - 8} textAnchor="middle">{p.label}</text>
          )}
        </g>
      ))}
    </svg>
  )
}
