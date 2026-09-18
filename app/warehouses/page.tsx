import Link from "next/link"
import { Suspense } from "react"

import type { ApiSuccess, WarehouseData } from "@/src/api/contracts"
import { buildHref, first, issuesHref, type SearchParams } from "@/src/api/query"
import { getApi } from "@/src/api/server"
import { DatasetStrip } from "@/src/components/dataset-strip"
import { ExportButton } from "@/src/components/export-button"
import { formatCount, formatDelta, formatMetric, formatPercent } from "@/src/components/format"
import { RouteLoading } from "@/src/components/route-loading"
import { DataNotice, EmptyState, ErrorState } from "@/src/components/state-panels"
import { SourceTag, WarehouseMatchBadge } from "@/src/components/status-badge"
import { WeekPicker } from "@/src/components/week-picker"

export const metadata = { title: "仓库分析 · 榆园售后经营平台" }

type Props = { searchParams: Promise<SearchParams> }

export default function WarehousesPage(props: Props) {
  return <Suspense fallback={<RouteLoading variant="table" />}><WarehousesContent {...props} /></Suspense>
}

async function WarehousesContent({ searchParams }: Props) {
  const query = await searchParams
  const week = first(query, "week")
  const selfHref = buildHref("/warehouses", [], { week })

  let api: Awaited<ReturnType<typeof getApi>> | null = null
  let result: ApiSuccess<WarehouseData> | null = null
  let error: unknown = null
  try {
    api = await getApi()
    result = await api.warehouses({ week })
  } catch (caught) {
    error = caught
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">WAREHOUSE</span>
          <h2>仓库分析</h2>
          <p>只统计五大分类中的“库房问题”。仓库售后率使用该仓库自己的订单分母；未完成映射的仓库不用全店订单兜底。</p>
        </div>
        <div className="page-heading-actions">
          {result ? <WeekPicker pathname="/warehouses" weeks={result.data.selectableWeeks} selected={result.data.week} /> : null}
          {api && result ? <ExportButton api={api} params={{ view: "warehouses", week: result.data.week.start, datasetVersion: result.meta.datasetVersion ?? "" }}>导出仓库分析</ExportButton> : null}
        </div>
      </div>

      {error || !result ? (
        <ErrorState error={error} retryHref={selfHref} context="仓库分析" />
      ) : (
        <WarehouseAnalysis data={result.data} meta={result.meta} />
      )}
    </>
  )
}

function WarehouseAnalysis({ data, meta }: { data: WarehouseData; meta: ApiSuccess<WarehouseData>["meta"] }) {
  const ratedRows = data.rows.filter((row) => row.rate.value !== null)
  const worst = ratedRows.sort((a, b) => (b.rate.value ?? 0) - (a.rate.value ?? 0))[0] ?? null
  const rising = data.rows.filter((row) => (row.deltaPp ?? 0) > 0).length
  const maxIssues = Math.max(1, ...data.rows.map((row) => row.currentIssues))

  return (
    <>
      <DatasetStrip meta={meta} windowLabel={`分析周期 ${data.week.label}，对比 ${data.previousWeek.label}`} />
      <DataNotice meta={meta} />

      <section className="summary-strip" aria-label="仓库汇总">
        <div>
          <small>本周库房问题</small>
          <strong>{formatCount(data.totalWarehouseIssues)}</strong>
          <Link className="inline-link" href={issuesHref({ week: data.week.start, category: "库房问题", status: "included" })}>查看全部库房问题</Link>
        </div>
        <div>
          <small>售后率最高仓库</small>
          <strong>{worst ? formatPercent(worst.rate.value) : "—"}</strong>
          <span className="muted">{worst ? `${worst.warehouseName ?? worst.warehouseCode} · ${formatCount(worst.currentIssues)} 个问题` : "所有仓库分母缺失"}</span>
        </div>
        <div>
          <small>售后率上升仓库</small>
          <strong className={rising ? "number-up" : undefined}>{formatCount(rising)}</strong>
          <span className="muted">环比 {data.previousWeek.label}</span>
        </div>
        <div>
          <small>待映射仓库</small>
          <strong className={data.pendingMappings ? "number-up" : undefined}>{formatCount(data.pendingMappings)}</strong>
          <span className="muted">{data.pendingMappings ? "映射完成前只显示问题数，不计算售后率" : "全部仓库已映射"}</span>
        </div>
      </section>

      <article className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">BY WAREHOUSE</span>
            <h3>仓库售后率</h3>
            <p>按本周库房问题数排序。仓库订单分母来自外部数据库 order_facts 按仓库拆分的口径。</p>
          </div>
        </div>

        {data.rows.length === 0 ? (
          <EmptyState title="该周没有库房问题" />
        ) : (
          <div className="table-scroll">
            <table className="warehouse-table">
              <thead>
                <tr>
                  <th scope="col">仓库</th>
                  <th scope="col">映射状态</th>
                  <th scope="col">来源</th>
                  <th className="num" scope="col">本周问题</th>
                  <th className="num" scope="col">上周问题</th>
                  <th className="num" scope="col">仓库订单</th>
                  <th className="num" scope="col">本周售后率</th>
                  <th className="num" scope="col">上周售后率</th>
                  <th className="num" scope="col">环比（pp）</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr className={row.matchStatus === "pending" ? "pending-row" : undefined} key={row.warehouseCode}>
                    <td>
                      <div className="cell-stack">
                        <Link className="row-link" href={issuesHref({ week: data.week.start, category: "库房问题", status: "included", warehouse: row.warehouseCode })}>{row.warehouseName ?? row.warehouseCode}</Link>
                        <small className="mono">{row.warehouseCode.startsWith("未映射:") ? "编码待映射" : row.warehouseCode}</small>
                      </div>
                    </td>
                    <td>
                      <div className="cell-stack">
                        <WarehouseMatchBadge status={row.matchStatus} />
                        {row.confidence !== null ? <small>置信度 {Math.round(row.confidence * 100)}%</small> : null}
                      </div>
                    </td>
                    <td><SourceTag source={row.sourceSystem} /></td>
                    <td className="num">
                      <div className="inline-bar">
                        <i style={{ width: `${(row.currentIssues / maxIssues) * 100}%` }} />
                        <strong>{formatCount(row.currentIssues)}</strong>
                      </div>
                    </td>
                    <td className="num">{formatCount(row.previousIssues)}</td>
                    <td className="num">
                      {row.orders.value === null ? <span className="empty-value" title={row.orders.reason ?? undefined}>—</span> : formatMetric(row.orders)}
                    </td>
                    <td className="num">
                      {row.rate.value === null ? (
                        <span className="cell-stack"><span className="empty-value">—</span><small>{row.rate.reason}</small></span>
                      ) : (
                        <strong className={row.rate.value >= 1 ? "number-up" : undefined}>{formatPercent(row.rate.value)}</strong>
                      )}
                    </td>
                    <td className="num">{row.previousRate.value === null ? <span className="empty-value">—</span> : formatPercent(row.previousRate.value)}</td>
                    <td className="num">
                      {row.deltaPp === null ? <span className="empty-value">—</span> : <span className={row.deltaPp > 0 ? "number-up" : row.deltaPp < 0 ? "number-down" : undefined}>{formatDelta(row.deltaPp)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="table-footer">
          <span>共 <strong>{formatCount(data.rows.length)}</strong> 个仓库 · 数据集 <strong className="mono">{meta.datasetVersion ?? "—"}</strong></span>
          <span>仓库售后率 = 该仓库库房问题 ÷ 该仓库订单；环比为百分点差</span>
        </div>
      </article>
    </>
  )
}
