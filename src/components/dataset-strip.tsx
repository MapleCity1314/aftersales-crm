import { Database, RefreshCw } from "lucide-react"
import Link from "next/link"

import type { ApiMeta, DatasetSummary, SourceStatus } from "@/src/api/contracts"

import { dataStateLabel, formatCount, formatDate, formatDateTime, sourceLabel } from "./format"

/**
 * 页面顶部的“先看口径，再看结论”状态条。
 * 列表类接口只带 meta，没有完整数据集摘要时退化为版本 + 生成时间。
 */
export function DatasetStrip({
  meta,
  dataset,
  sources,
  windowLabel,
  extra,
}: {
  meta: ApiMeta
  dataset?: DatasetSummary | null
  sources?: SourceStatus[] | null
  windowLabel?: string
  extra?: React.ReactNode
}) {
  const stale = meta.dataState !== "ready"
  return (
    <section className={stale ? `source-strip ${meta.dataState}` : "source-strip"} aria-label="数据口径与状态">
      <span>
        <RefreshCw aria-hidden="true" size={14} /> {dataStateLabel(meta.dataState)} · {dataset ? `发布于 ${formatDateTime(dataset.publishedAt)}` : `生成于 ${formatDateTime(meta.generatedAt)}`}
      </span>
      <span>
        <Database aria-hidden="true" size={14} /> <Link className="inline-link" href="/data-quality">{dataset?.version ?? meta.datasetVersion ?? "未发布"}</Link>
      </span>
      {dataset ? <span>覆盖 {formatDate(dataset.coverageStart)} 至 {formatDate(dataset.coverageEnd)}</span> : null}
      {windowLabel ? <span>{windowLabel}</span> : null}
      {dataset ? (
        <span>
          来源构成 {dataset.sourceBreakdown.filter((entry) => entry.sourceSystem !== "external_db").map((entry) => `${sourceLabel(entry.sourceSystem)} ${formatCount(entry.rows)} 行`).join(" / ")}
        </span>
      ) : null}
      {sources?.some((source) => source.status !== "succeeded") ? <span>有来源同步状态待处理</span> : null}
      {extra}
    </section>
  )
}
