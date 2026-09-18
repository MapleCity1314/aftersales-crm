import type { LucideIcon } from "lucide-react"
import Link from "next/link"

import type { KpiMetric } from "@/src/api/contracts"

import { EMPTY, formatCount, formatDelta, formatPercent, formatSignedCount } from "./format"

type Tone = "neutral" | "good" | "warning" | "critical" | "unavailable"

export function KpiCard({
  label,
  metric,
  kind = "count",
  icon: Icon,
  href,
  note,
  tone,
  higherIsWorse = true,
}: {
  label: string
  metric: KpiMetric
  kind?: "count" | "percent"
  icon: LucideIcon
  href?: string
  note?: string
  tone?: Tone
  higherIsWorse?: boolean
}) {
  const unavailable = metric.value === null
  const value = unavailable ? EMPTY : kind === "percent" ? formatPercent(metric.value) : formatCount(metric.value)
  const deltaText = metric.delta === null ? null : metric.deltaKind === "pp" ? formatDelta(metric.delta) : formatSignedCount(metric.delta)
  const direction = metric.delta === null || metric.delta === 0 ? "" : (metric.delta > 0) === higherIsWorse ? "up" : "down"
  const resolvedTone: Tone = unavailable ? "unavailable" : tone ?? "neutral"
  const body = (
    <>
      <span className="metric-icon"><Icon aria-hidden="true" size={19} /></span>
      <div className="metric-label">{label}</div>
      <div className={unavailable ? "metric-value empty" : "metric-value"}>{value}</div>
      {unavailable ? (
        <div className="metric-reason">{metric.reason ?? "数值不可用"}</div>
      ) : (
        <div className="metric-note">
          {deltaText ? <><span className={direction}>{deltaText}</span><span>较 {metric.previousLabel}</span></> : <span>无可比较的上一周期</span>}
          {note ? <span>· {note}</span> : null}
        </div>
      )}
    </>
  )
  if (href) return <Link className={`metric-card ${resolvedTone}`} href={href}>{body}</Link>
  return <article className={`metric-card ${resolvedTone}`}>{body}</article>
}
