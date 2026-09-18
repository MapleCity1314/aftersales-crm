import Link from "next/link"

import type { TrendPoint } from "@/src/api/contracts"
import { issuesHref } from "@/src/api/query"

import { formatCount, formatDelta, formatPercent } from "./format"

/**
 * 五周趋势图：柱子是经营异常问题数，折线是经营异常售后率。
 * 分母缺失的周不画点、不连线，并在轴标上标出原因，避免把缺失画成 0。
 */
export function TrendChart({ trend, cutoverStart }: { trend: TrendPoint[]; cutoverStart?: string | null }) {
  const issueMax = Math.max(1, ...trend.map((point) => point.operatingIssues.value ?? 0))
  const rates = trend.map((point) => point.rate.value).filter((value): value is number => value !== null)
  const rateMax = Math.max(0.5, ...rates) * 1.15
  const columns = trend.length
  const step = 100 / columns

  const points = trend.map((point, index) => ({
    x: step * index + step / 2,
    y: point.rate.value === null ? null : 100 - (point.rate.value / rateMax) * 100,
    point,
  }))

  const segments: string[] = []
  let current: string[] = []
  for (const p of points) {
    if (p.y === null) {
      if (current.length > 1) segments.push(current.join(" "))
      current = []
      continue
    }
    current.push(`${p.x},${p.y}`)
  }
  if (current.length > 1) segments.push(current.join(" "))

  return (
    <figure className="trend-chart">
      <div className="trend-plot" role="img" aria-label={`最近 ${columns} 个完整周的经营异常问题数与售后率`}>
        <div className="trend-gridlines" aria-hidden="true">
          {[0, 25, 50, 75].map((tick) => (
            <span key={tick} style={{ top: `${tick}%` }}><small>{formatPercent(rateMax * (1 - tick / 100), 1)}</small></span>
          ))}
        </div>
        <div className="trend-bars" aria-hidden="true">
          {trend.map((point) => {
            const value = point.operatingIssues.value
            const height = value === null ? 0 : Math.max(2, (value / issueMax) * 100)
            return (
              <div className={point.week.start === cutoverStart ? "trend-column cutover" : "trend-column"} key={point.week.start}>
                <i className={value === null ? "bar missing" : "bar"} style={{ height: `${height}%` }} />
              </div>
            )
          })}
        </div>
        <svg aria-hidden="true" className="trend-line" preserveAspectRatio="none" viewBox="0 0 100 100">
          {segments.map((segment) => <polyline fill="none" key={segment} points={segment} vectorEffect="non-scaling-stroke" />)}
        </svg>
        {points.map(({ x, y, point }) => (
          <span
            aria-hidden="true"
            className={y === null ? "trend-dot missing" : "trend-dot"}
            key={point.week.start}
            style={{ left: `${x}%`, top: y === null ? "50%" : `${y}%` }}
            title={y === null ? point.rate.reason ?? "分母缺失" : `${point.week.label} 售后率 ${formatPercent(point.rate.value)}`}
          />
        ))}
      </div>
      <ol className="trend-axis">
        {trend.map((point) => (
          <li key={point.week.start}>
            <Link className="trend-week" href={issuesHref({ week: point.week.start, status: "included" })}>{point.week.label}</Link>
            <strong>{formatCount(point.operatingIssues.value)}</strong>
            <small className={point.rate.value === null ? "empty-value" : undefined}>
              {point.rate.value === null ? point.rate.reason ?? "—" : `${formatPercent(point.rate.value)} · 环比 ${formatDelta(point.wow.value)}`}
            </small>
          </li>
        ))}
      </ol>
      <figcaption className="trend-legend">
        <span><i className="swatch bar" /> 经营异常问题数</span>
        <span><i className="swatch line" /> 经营异常售后率</span>
        <span><i className="swatch missing" /> 分母缺失，不显示为 0</span>
      </figcaption>
    </figure>
  )
}
