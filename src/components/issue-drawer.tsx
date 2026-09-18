import { Boxes, FileJson2, Fingerprint, GitBranch, ScrollText, Tags, X } from "lucide-react"
import Link from "next/link"

import type { IssueDetail } from "@/src/api/contracts"

import { EMPTY, formatCount, formatDateTime, formatMoney, sourceLabel, warehouseMatchLabel } from "./format"
import { Badge, ClassificationBadge, RunStatusBadge, SourceTag } from "./status-badge"

interface Props {
  detail: IssueDetail
  closeHref: string
  isAdmin: boolean
}

function Value({ value, mono = false }: { value: string | number | null | undefined; mono?: boolean }) {
  if (value === null || value === undefined || value === "") return <dd className="empty-value">{EMPTY}</dd>
  return <dd className={mono ? "mono" : undefined}>{value}</dd>
}

/**
 * 右侧详情抽屉。分区固定为：业务信息、问题分类、商品/订单、来源证据、同步运行、原始字段摘要。
 * 原始 JSON 默认折叠且只对管理员返回。
 */
export function IssueDrawer({ detail, closeHref, isAdmin }: Props) {
  return (
    <aside className="panel drawer" aria-label={`问题行 ${detail.ticketItemId} 详情`}>
      <header className="drawer-head">
        <div>
          <span className="eyebrow">TICKET ITEM</span>
          <h3>{detail.productTitle ?? "未提供商品标题"}</h3>
          <span className="mono">{detail.ticketItemId} · 业务键 {detail.businessKey}</span>
        </div>
        <Link className="drawer-close" href={closeHref} scroll={false} aria-label="关闭详情"><X aria-hidden="true" size={16} /></Link>
      </header>

      <div className="drawer-body">
        <section className="drawer-section">
          <h4><ScrollText aria-hidden="true" size={14} /> 业务信息</h4>
          <dl className="kv">
            <dt>来源</dt><dd><SourceTag source={detail.sourceSystem} /> <span className="mono">{detail.sourceTicketId}</span></dd>
            <dt>店铺</dt><Value value={detail.shopName} />
            <dt>工单状态</dt><Value value={detail.status} />
            <dt>创建时间</dt><Value value={formatDateTime(detail.createdAt)} />
            <dt>更新时间</dt><Value value={detail.updatedAt ? formatDateTime(detail.updatedAt) : null} />
            <dt>付款时间</dt><Value value={detail.paymentAt ? formatDateTime(detail.paymentAt) : null} />
            <dt>申请退款</dt><Value value={detail.refundRequestedAt ? formatDateTime(detail.refundRequestedAt) : null} />
            <dt>售后金额</dt><Value value={formatMoney(detail.afterSalesAmount)} mono />
            <dt>退款金额</dt><Value value={formatMoney(detail.refundAmount)} mono />
          </dl>
          {detail.crossSourceSuspect ? (
            <p className="missing-list"><Badge tone="warning">疑似跨来源重复</Badge> 交界周内在班牛与新工单同时出现相似记录，等待人工确认；未确认前两条都保留并分别计数。</p>
          ) : null}
        </section>

        <section className="drawer-section">
          <h4><Tags aria-hidden="true" size={14} /> 问题分类</h4>
          <dl className="kv">
            <dt>一级问题</dt><Value value={detail.p1} />
            <dt>二级问题</dt><Value value={detail.p2} />
            <dt>三级问题</dt><Value value={detail.p3} />
            <dt>五大分类</dt><dd>{detail.category ?? <Badge tone="warning">待归类</Badge>}</dd>
            <dt>统计状态</dt><dd><ClassificationBadge status={detail.classificationStatus} /></dd>
            <dt>纳入经营</dt><dd>{detail.includedInOperating ? "是" : "否"}</dd>
          </dl>
        </section>

        <section className="drawer-section">
          <h4><Boxes aria-hidden="true" size={14} /> 商品 / 订单 / 仓库</h4>
          <dl className="kv">
            <dt>商家编码</dt>{detail.merchantCode ? <Value value={detail.merchantCode} mono /> : <dd><Badge tone="warning">待匹配</Badge></dd>}
            <dt>商品 ID</dt><Value value={detail.productId} mono />
            <dt>SKU</dt><Value value={detail.skuText} />
            <dt>数量</dt><Value value={detail.quantity !== null ? formatCount(detail.quantity) : null} />
            <dt>订单号</dt><Value value={detail.orderId} mono />
            <dt>子订单号</dt><Value value={detail.subOrderId} mono />
            <dt>仓库</dt><dd>{detail.warehouseName ?? detail.warehouseCode ?? EMPTY} <small className="muted">· {warehouseMatchLabel(detail.warehouseMatchStatus)}</small></dd>
            <dt>仓库编码</dt><Value value={detail.warehouseCode} mono />
            <dt>快递公司</dt><Value value={detail.carrierName} />
            <dt>运单号</dt><Value value={detail.trackingNo} mono />
          </dl>
        </section>

        <section className="drawer-section">
          <h4><Fingerprint aria-hidden="true" size={14} /> 来源证据</h4>
          {detail.evidence ? (
            <dl className="kv">
              <dt>证据 ID</dt><Value value={detail.evidence.evidenceId} mono />
              <dt>原始记录</dt><Value value={detail.evidence.rawRecordId} mono />
              <dt>内容哈希</dt><Value value={detail.evidence.contentHash} mono />
              <dt>采集时间</dt><Value value={formatDateTime(detail.evidence.observedAt)} />
              <dt>请求窗口</dt><dd>{formatDateTime(detail.evidence.requestWindowStart)} → {formatDateTime(detail.evidence.requestWindowEnd)}</dd>
              <dt>分页定位</dt><dd className="mono">{detail.evidence.pageNo !== null ? `第 ${detail.evidence.pageNo} 页` : EMPTY}{detail.evidence.pageCursor ? ` · ${detail.evidence.pageCursor}` : ""}</dd>
            </dl>
          ) : (
            <p className="missing-list">该问题行尚未生成证据记录（evidence_id 为空）。在证据补齐前，该行只能定位到同步批次，不能反查原始记录。</p>
          )}
        </section>

        <section className="drawer-section">
          <h4><GitBranch aria-hidden="true" size={14} /> 同步运行</h4>
          <dl className="kv">
            <dt>运行 ID</dt><dd><Link className="inline-link mono" href={`/data-quality/runs/${detail.syncRun.runId}`}>{detail.syncRun.runId}</Link></dd>
            <dt>任务</dt><Value value={detail.syncRun.task} />
            <dt>状态</dt><dd><RunStatusBadge status={detail.syncRun.status} /></dd>
            <dt>开始</dt><Value value={formatDateTime(detail.syncRun.startedAt)} />
            <dt>结束</dt><Value value={detail.syncRun.finishedAt ? formatDateTime(detail.syncRun.finishedAt) : null} />
            <dt>数据窗口</dt><dd>{formatDateTime(detail.syncRun.windowStart)} → {formatDateTime(detail.syncRun.windowEnd)}</dd>
          </dl>
        </section>

        <section className="drawer-section">
          <h4><FileJson2 aria-hidden="true" size={14} /> 原始字段摘要（{sourceLabel(detail.sourceSystem)}，已脱敏）</h4>
          <dl className="kv">
            {detail.rawSummary.map((entry) => (
              <FragmentRow key={entry.field} field={entry.field} value={entry.value} />
            ))}
          </dl>
          {detail.missingFields.length > 0 ? (
            <div className="missing-list" role="note">
              <strong>缺失字段（保留空值，不使用猜测值）</strong>
              {detail.missingFields.map((missing) => <span key={missing.field}><code>{missing.field}</code>：{missing.reason}</span>)}
            </div>
          ) : null}
          {isAdmin ? (
            detail.rawPayload ? (
              <details className="raw-json">
                <summary>展开原始 JSON（仅管理员，访问会记入审计日志）</summary>
                <pre>{detail.rawPayload}</pre>
              </details>
            ) : <p className="muted" style={{ marginTop: 8, fontSize: 11 }}>原始 JSON 尚未随该记录返回。</p>
          ) : (
            <p className="muted" style={{ marginTop: 8, fontSize: 11 }}>原始 JSON 仅管理员可查看；当前角色只展示脱敏摘要。</p>
          )}
        </section>
      </div>
    </aside>
  )
}

function FragmentRow({ field, value }: { field: string; value: string | null }) {
  return (
    <>
      <dt className="mono">{field}</dt>
      <Value value={value} />
    </>
  )
}
