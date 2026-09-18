import Link from "next/link"

import type { CategoryShare, ProductWatchRow, TrendPoint, WarehouseRiskRow } from "@/src/api/contracts"
import { issuesHref } from "@/src/api/query"

import { EMPTY, formatCount, formatDelta, formatMetric, formatPercent, formatSignedCount, sourceLabel } from "./format"
import { EmptyState } from "./state-panels"
import { SourceTag, WarehouseMatchBadge } from "./status-badge"

function deltaClass(value: number | null | undefined) {
  if (value === null || value === undefined || value === 0) return "num"
  return value > 0 ? "num number-up" : "num number-down"
}

export function TrendTable({ trend }: { trend: TrendPoint[] }) {
  const cutover = trend.find((point) => point.reconciliation)
  return (
    <>
      <div className="table-scroll">
        <table className="trend-table">
          <thead>
            <tr>
              <th>完整周</th>
              <th>来源</th>
              <th className="num">全量问题</th>
              <th className="num">经营异常</th>
              <th className="num">销售订单</th>
              <th className="num">产品销量</th>
              <th className="num">经营异常售后率</th>
              <th className="num">周环比</th>
            </tr>
          </thead>
          <tbody>
            {trend.map((point) => (
              <tr className={point.reconciliation ? "cutover" : undefined} key={point.week.start}>
                <td><Link className="row-link" href={issuesHref({ week: point.week.start })}>{point.week.label}</Link>{point.reconciliation ? <small className="muted"> 交界周</small> : null}</td>
                <td><span className="trend-sources">{point.sources.map((source) => <SourceTag key={source} source={source} />)}</span></td>
                <td className="num">{formatMetric(point.allIssues)}</td>
                <td className="num">{formatMetric(point.operatingIssues)}</td>
                <td className="num" title={point.orders.reason ?? undefined}>{formatMetric(point.orders)}</td>
                <td className="num" title={point.sales.reason ?? undefined}>{formatMetric(point.sales)}</td>
                <td className="num" title={point.rate.reason ?? undefined}>{formatMetric(point.rate, "percent")}</td>
                <td className={deltaClass(point.wow.value)} title={point.wow.reason ?? undefined}>{formatDelta(point.wow.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {cutover?.reconciliation ? (
        <div className="reconciliation" role="note">
          <strong>交界周 {cutover.week.label}：班牛与新工单对账{cutover.reconciliation.status === "pending" ? "待人工确认" : "已确认"}</strong>
          <dl>
            <div><dt>{sourceLabel("banniu")}</dt><dd>{formatCount(cutover.reconciliation.banniu)}</dd></div>
            <div><dt>{sourceLabel("ticket_service")}</dt><dd>{formatCount(cutover.reconciliation.ticketService)}</dd></div>
            <div><dt>重叠</dt><dd>{formatCount(cutover.reconciliation.overlap)}</dd></div>
            <div><dt>缺失</dt><dd>{formatCount(cutover.reconciliation.missing)}</dd></div>
            <div><dt>疑似重复</dt><dd>{formatCount(cutover.reconciliation.suspectedDuplicates)}</dd></div>
          </dl>
          <span>疑似跨来源重复只做标记，不会自动合并；本周数字为两侧去重前的合并结果。</span>
        </div>
      ) : null}
    </>
  )
}

export function CategoryBreakdown({ categories, week }: { categories: CategoryShare[]; week: string }) {
  const max = Math.max(1, ...categories.map((entry) => entry.issues ?? 0))
  if (categories.every((entry) => entry.issues === null)) {
    return <EmptyState title="分类分布不可用" description="数据窗口内没有可分类的售后记录。" />
  }
  return (
    <div className="category-list">
      {categories.map((entry) => {
        const unclassified = entry.category === "待归类"
        return (
          <Link
            className={unclassified ? "category-row unclassified" : "category-row"}
            href={issuesHref({ week, ...(unclassified ? { status: "unclassified" } : { category: entry.category, status: "included" }) })}
            key={entry.category}
          >
            <strong>{entry.category}</strong>
            <span className="category-bar"><i style={{ width: `${entry.issues === null ? 0 : Math.max(2, (entry.issues / max) * 100)}%` }} /></span>
            <span className="num">{formatCount(entry.issues)}<br /><small>{entry.share === null ? EMPTY : formatPercent(entry.share, 1)}</small></span>
            <span className={deltaClass(entry.delta)}>{formatSignedCount(entry.delta)}<br /><small className="muted">较上期</small></span>
          </Link>
        )
      })}
    </div>
  )
}

export function ProductWatchlist({ rows, week }: { rows: ProductWatchRow[]; week: string }) {
  if (!rows.length) return <EmptyState title="没有产品预警" description="数据窗口内没有已匹配商家编码的经营异常问题。" />
  return (
    <div className="watch-list">
      {rows.map((row, index) => (
        <Link className="watch-row" href={issuesHref({ week, merchantCode: row.merchantCode, status: "included" })} key={row.merchantCode}>
          <span className="rank">{String(index + 1).padStart(2, "0")}</span>
          <span className="watch-copy"><strong>{row.productTitle}</strong><small>{row.merchantCode} · {row.productIdCount} 个商品 ID</small></span>
          <span className="watch-metric"><strong>{formatCount(row.currentIssues)}</strong><small className={deltaClass(row.delta)}>{formatSignedCount(row.delta)}</small></span>
          <span className="watch-metric"><strong className="muted" title={row.rate.reason ?? undefined}>{formatMetric(row.rate, "percent")}</strong><small>售后率</small></span>
        </Link>
      ))}
    </div>
  )
}

export function WarehouseRiskList({ rows, week }: { rows: WarehouseRiskRow[]; week: string }) {
  if (!rows.length) return <EmptyState title="没有仓库风险" description="数据窗口内没有库房问题。" />
  return (
    <div className="watch-list">
      {rows.map((row) => (
        <Link className="watch-row" href={issuesHref({ week, warehouse: row.warehouseCode, category: "库房问题" })} key={row.warehouseCode}>
          <span className="rank">{row.matchStatus === "pending" ? "待" : "仓"}</span>
          <span className="watch-copy"><strong>{row.warehouseName ?? row.warehouseCode}</strong><small>{row.matchStatus === "pending" ? "未完成编码映射" : row.warehouseCode}</small></span>
          <span className="watch-metric"><strong>{formatCount(row.currentIssues)}</strong><small className={deltaClass(row.delta)}>{formatSignedCount(row.delta)}</small></span>
          <span className="watch-metric"><strong className="muted" title={row.rate.reason ?? undefined}>{formatMetric(row.rate, "percent")}</strong><WarehouseMatchBadge status={row.matchStatus} /></span>
        </Link>
      ))}
    </div>
  )
}
