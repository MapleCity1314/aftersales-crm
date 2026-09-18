import { Database, RefreshCw } from "lucide-react"
import Link from "next/link"

import type { ApiMeta, DatasetSummary, SourceStatus } from "@/src/api/contracts"

import { dataStateLabel, formatCount, formatDate, formatDateTime, sourceLabel } from "./format"

/** 页面顶部的“先看口径，再看结论”状态条。 */
export function DatasetStrip({
  meta,
  dataset,
  sources,
  windowLabel,
  extra,
}: {
  meta: ApiMeta
  dataset: DatasetSummary
  sources?: SourceStatus[]
  windowLabel?: string
  extra?: React.ReactNode
}) {
  const stale = meta.dataState !== "ready"
  return (
    <section className={stale ? `source-strip ${meta.dataState}` : "source-strip"} aria-label="数据口径与状态">
      <span><RefreshCw aria-hidden="true" size={14} /> {dataStateLabel(meta.dataState)} · 发布于 {formatDateTime(dataset.publishedAt)}</span>
      <span><Database aria-hidden="true" size={14} /> <Link className="inline-link" href="/data-quality">{dataset.version}</Link></span>
      <span>覆盖 {formatDate(dataset.coverageStart)} 至 {formatDate(dataset.coverageEnd)}</span>
      {windowLabel ? <span>{windowLabel}</span> : null}
      <span>
        来源构成 {dataset.sourceBreakdown.filter((entry) => entry.sourceSystem !== "external_db").map((entry) => `${sourceLabel(entry.sourceSystem)} ${formatCount(entry.rows)} 行`).join(" / ")}
      </span>
      {sources?.some((source) => source.status !== "succeeded") ? <span>有来源同步状态待处理</span> : null}
      {extra}
    </section>
  )
}
