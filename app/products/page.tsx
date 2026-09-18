import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"

import type { ApiSuccess, ProductWeeklyData } from "@/src/api/contracts"
import { buildHref, first, issuesHref, type SearchParams } from "@/src/api/query"
import { getApi } from "@/src/api/server"
import { DatasetStrip } from "@/src/components/dataset-strip"
import { ExportButton } from "@/src/components/export-button"
import { formatCount, formatSignedCount } from "@/src/components/format"
import { RouteLoading } from "@/src/components/route-loading"
import { DataNotice, EmptyState, ErrorState } from "@/src/components/state-panels"
import { Badge, SourceTag } from "@/src/components/status-badge"
import { WeekPicker } from "@/src/components/week-picker"

export const metadata = { title: "产品周报 · 榆园售后经营平台" }

type Props = { searchParams: Promise<SearchParams> }

export default function ProductsPage(props: Props) {
  return <Suspense fallback={<RouteLoading variant="table" />}><ProductsContent {...props} /></Suspense>
}

async function ProductsContent({ searchParams }: Props) {
  const query = await searchParams
  const week = first(query, "week")
  const sort = first(query, "sort") === "delta" ? "delta" : "issues"
  const selfHref = buildHref("/products", [], { week, sort: sort === "delta" ? "delta" : undefined })

  let api: Awaited<ReturnType<typeof getApi>> | null = null
  let result: ApiSuccess<ProductWeeklyData> | null = null
  let error: unknown = null
  try {
    api = await getApi()
    result = await api.productsWeekly({ week })
  } catch (caught) {
    error = caught
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">PRODUCT WEEKLY</span>
          <h2>产品周报</h2>
          <p>按商家编码汇总的完整周经营异常问题。同一商家编码下的多个商品 ID 合并，未匹配到编码的问题单独列出。</p>
        </div>
        <div className="page-heading-actions">
          {result ? <WeekPicker pathname="/products" weeks={result.data.selectableWeeks} selected={result.data.selectedWeek} extra={{ sort: sort === "delta" ? "delta" : undefined }} /> : null}
          {api && result ? <ExportButton api={api} params={{ view: "products", week: result.data.selectedWeek.start, datasetVersion: result.meta.datasetVersion ?? "" }}>导出产品周报</ExportButton> : null}
        </div>
      </div>

      {error || !result ? (
        <ErrorState error={error} retryHref={selfHref} context="产品周报" />
      ) : (
        <ProductWeekly data={result.data} meta={result.meta} sort={sort} />
      )}
    </>
  )
}

function ProductWeekly({ data, meta, sort }: { data: ProductWeeklyData; meta: ApiSuccess<ProductWeeklyData>["meta"]; sort: "issues" | "delta" }) {
  const rows = sort === "delta" ? [...data.rows].sort((a, b) => b.delta - a.delta || b.currentIssues - a.currentIssues) : data.rows
  const risers = data.rows.filter((row) => row.delta > 0).length
  const fallers = data.rows.filter((row) => row.delta < 0).length
  const backfillTone = data.backfill.status === "complete" ? "good" : data.backfill.status === "pending" ? "warning" : "neutral"
  const backfillLabel = { complete: "补数完成", preview_recorded: "已记录预览", pending: "等待对账", not_started: "未开始" }[data.backfill.status]

  return (
    <>
      <DatasetStrip
        meta={meta}
        windowLabel={`分析周期 ${data.selectedWeek.label}，对比 ${data.previousWeek.label}`}
        extra={<span>来源构成 {data.sourceBreakdown.map((entry) => `${entry.sourceSystem === "banniu" ? "班牛" : "新工单"} ${formatCount(entry.issues)}`).join(" / ") || "—"}</span>}
      />
      <DataNotice meta={meta} />

      <section className="summary-strip" aria-label="本周汇总">
        <div>
          <small>本周经营异常问题</small>
          <strong>{formatCount(data.totalOperatingIssues)}</strong>
          <span className="muted">已匹配编码 {formatCount(data.matchedIssues)} · 未匹配 {formatCount(data.unmatchedIssues)}</span>
        </div>
        <div>
          <small>涉及商家编码</small>
          <strong>{formatCount(data.rows.filter((row) => row.currentIssues > 0).length)}</strong>
          <span className="muted">上升 {risers} 个 · 下降 {fallers} 个</span>
        </div>
        <div>
          <small>补数状态</small>
          <strong><Badge tone={backfillTone}>{backfillLabel}</Badge></strong>
          <span className="muted">{data.backfill.note}</span>
        </div>
        <div>
          <small>未匹配商家编码</small>
          <strong className={data.unmatchedIssues ? "number-up" : undefined}>{formatCount(data.unmatchedIssues)}</strong>
          {data.unmatchedIssues ? (
            <Link className="inline-link" href={issuesHref({ week: data.selectedWeek.start, status: "included", merchantCode: "__unmatched__" })}>查看未匹配问题</Link>
          ) : (
            <span className="muted">本周全部匹配</span>
          )}
        </div>
      </section>

      <article className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">BY MERCHANT CODE</span>
            <h3>商家编码周报</h3>
            <p>点击行进入问题工作台，筛选条件会带上该编码与分析周。</p>
          </div>
          <div className="segmented" role="group" aria-label="排序">
            <Link className={sort === "issues" ? "selected" : undefined} href={buildHref("/products", [], { week: data.selectedWeek.start })}>按问题数</Link>
            <Link className={sort === "delta" ? "selected" : undefined} href={buildHref("/products", [], { week: data.selectedWeek.start, sort: "delta" })}>按周变化</Link>
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState title="该周没有匹配到商家编码的经营异常问题" description="补数完成且规则无变化时，这里为空表示该周确实没有纳入经营异常的问题；不会以 0 填充空白周。" />
        ) : (
          <div className="table-scroll">
            <table className="product-table">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">商家编码 / 商品</th>
                  <th className="num" scope="col">商品 ID 数</th>
                  <th className="num" scope="col">本周问题</th>
                  <th className="num" scope="col">上周问题</th>
                  <th className="num" scope="col">周变化</th>
                  <th scope="col">占比</th>
                  <th scope="col">来源</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const share = data.totalOperatingIssues ? (row.currentIssues / data.totalOperatingIssues) * 100 : 0
                  return (
                    <tr key={row.merchantCode}>
                      <td className="rank">{String(index + 1).padStart(2, "0")}</td>
                      <td>
                        <div className="cell-stack">
                          <Link className="row-link" href={issuesHref({ week: data.selectedWeek.start, status: "included", merchantCode: row.merchantCode })}>{row.merchantCode}</Link>
                          <small title={row.productTitle}>{row.productTitle}</small>
                        </div>
                      </td>
                      <td className="num">{formatCount(row.productIdCount)}</td>
                      <td className="num"><strong>{formatCount(row.currentIssues)}</strong></td>
                      <td className="num">{formatCount(row.previousIssues)}</td>
                      <td className="num">
                        <span className={row.delta > 0 ? "delta-pill up" : row.delta < 0 ? "delta-pill down" : "delta-pill"}>
                          {row.delta > 0 ? <ArrowUpRight aria-hidden="true" size={12} /> : row.delta < 0 ? <ArrowDownRight aria-hidden="true" size={12} /> : <Minus aria-hidden="true" size={12} />}
                          {formatSignedCount(row.delta)}
                        </span>
                      </td>
                      <td>
                        <div className="share-bar" aria-label={`占本周经营异常问题 ${share.toFixed(1)}%`}>
                          <i style={{ width: `${Math.min(100, share)}%` }} />
                          <small>{share.toFixed(1)}%</small>
                        </div>
                      </td>
                      <td><span className="trend-sources">{row.sources.map((source) => <SourceTag key={source} source={source} />)}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="table-footer">
          <span>共 <strong>{formatCount(rows.length)}</strong> 个商家编码 · 数据集 <strong className="mono">{meta.datasetVersion ?? "—"}</strong></span>
          <span>周变化 = 本周问题 − 上周问题（{data.previousWeek.label}）</span>
        </div>
      </article>
    </>
  )
}
