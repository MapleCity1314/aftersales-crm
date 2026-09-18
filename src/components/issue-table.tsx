import { ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"

import type { IssueListData } from "@/src/api/contracts"

import { EMPTY, formatCount, formatMoney, formatShortDateTime, warehouseMatchLabel } from "./format"
import { EmptyState } from "./state-panels"
import { Badge, ClassificationBadge, SourceTag } from "./status-badge"

interface Props {
  data: IssueListData
  selectedId: string | null
  /** 生成保留当前筛选条件的链接。 */
  hrefWith: (extra: Record<string, string | undefined>) => string
}

export function IssueTable({ data, selectedId, hrefWith }: Props) {
  const page = Math.floor(data.offset / data.limit) + 1
  const pages = Math.max(1, Math.ceil(data.total / data.limit))

  if (data.items.length === 0) {
    return (
      <EmptyState
        title="当前筛选条件下没有问题记录"
        description="可能原因：该周期尚未补数、来源同步未覆盖该窗口，或筛选条件过窄。请先放宽筛选或到“同步与数据质量”确认数据窗口。"
        action={<Link className="button ghost" href="/issues">清空筛选</Link>}
      />
    )
  }

  return (
    <>
      <div className="table-scroll">
        <table className="issue-table">
          <thead>
            <tr>
              <th>工单 / 问题行</th>
              <th>来源</th>
              <th>创建 / 更新</th>
              <th>产品</th>
              <th>订单</th>
              <th>问题路径</th>
              <th>统计状态</th>
              <th>仓库 / 物流</th>
              <th className="num">售后 / 退款金额</th>
              <th>批次 / 证据</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => {
              const selected = item.ticketItemId === selectedId
              return (
                <tr key={item.ticketItemId} className={selected ? "selected" : undefined} aria-selected={selected}>
                  <td>
                    <div className="cell-stack">
                      <Link className="row-link mono" href={hrefWith({ selected: item.ticketItemId })} scroll={false} aria-label={`查看 ${item.ticketItemId} 详情`}>{item.ticketItemId}</Link>
                      <small>{item.shopName ?? EMPTY}{item.status ? ` · ${item.status}` : ""}</small>
                    </div>
                  </td>
                  <td>
                    <div className="cell-stack">
                      <SourceTag source={item.sourceSystem} />
                      <small className="mono">{item.sourceTicketId}</small>
                      {item.crossSourceSuspect ? <Badge tone="warning">疑似跨来源重复</Badge> : null}
                    </div>
                  </td>
                  <td>
                    <div className="cell-stack">
                      <span>{formatShortDateTime(item.createdAt)}</span>
                      <small>更新 {formatShortDateTime(item.updatedAt)}</small>
                    </div>
                  </td>
                  <td style={{ maxWidth: 220 }}>
                    <div className="cell-stack">
                      <strong title={item.productTitle ?? undefined}>{item.productTitle ?? EMPTY}</strong>
                      <small className="mono">{item.merchantCode ?? "待匹配"} · {item.productId ?? EMPTY}</small>
                      <small>{item.skuText ?? EMPTY}{item.quantity !== null ? ` × ${item.quantity}` : ""}</small>
                    </div>
                  </td>
                  <td>
                    <div className="cell-stack">
                      <span className="mono">{item.orderId ?? EMPTY}</span>
                      <small className="mono">{item.subOrderId ?? EMPTY}</small>
                    </div>
                  </td>
                  <td style={{ maxWidth: 200 }}>
                    <div className="cell-stack">
                      <strong>{item.p1 ?? EMPTY}</strong>
                      <small>{[item.p2, item.p3].filter(Boolean).join(" / ") || EMPTY}</small>
                    </div>
                  </td>
                  <td>
                    <div className="cell-stack">
                      <ClassificationBadge status={item.classificationStatus} />
                      <small>{item.category ?? "待归类"}</small>
                    </div>
                  </td>
                  <td>
                    <div className="cell-stack">
                      <span>{item.warehouseName ?? item.warehouseCode ?? EMPTY}</span>
                      <small>{warehouseMatchLabel(item.warehouseMatchStatus)}{item.carrierName ? ` · ${item.carrierName}` : ""}</small>
                      <small className="mono">{item.trackingNo ?? EMPTY}</small>
                    </div>
                  </td>
                  <td className="num money">
                    <div className="cell-stack">
                      <span>{formatMoney(item.afterSalesAmount)}</span>
                      <small>{formatMoney(item.refundAmount)}</small>
                    </div>
                  </td>
                  <td>
                    <div className="cell-stack">
                      <Link className="inline-link mono" href={`/data-quality/runs/${item.sourceRunId}`}>{item.sourceRunId}</Link>
                      <Badge tone={item.evidenceStatus === "verified" ? "good" : item.evidenceStatus === "pending" ? "warning" : "critical"}>
                        {item.evidenceStatus === "verified" ? "证据已核" : item.evidenceStatus === "pending" ? "证据待核" : "证据缺失"}
                      </Badge>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="table-footer">
        <span>
          显示第 <strong>{formatCount(data.offset + 1)}–{formatCount(Math.min(data.offset + data.limit, data.total))}</strong> 条，共 <strong>{formatCount(data.total)}</strong> 条 · 每页 {data.limit}
        </span>
        <nav className="pagination" aria-label="分页">
          {page > 1 ? <Link href={hrefWith({ page: String(page - 1) })} rel="prev"><ChevronLeft aria-hidden="true" size={14} /> 上一页</Link> : <span><ChevronLeft aria-hidden="true" size={14} /> 上一页</span>}
          <span aria-current="page">第 {page} / {pages} 页</span>
          {page < pages ? <Link href={hrefWith({ page: String(page + 1) })} rel="next">下一页 <ChevronRight aria-hidden="true" size={14} /></Link> : <span>下一页 <ChevronRight aria-hidden="true" size={14} /></span>}
        </nav>
      </div>
    </>
  )
}
