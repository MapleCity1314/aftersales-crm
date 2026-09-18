import { AlertTriangle, Clock, DatabaseZap, Inbox, Lock, RefreshCw, ShieldAlert } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

import { isApiError } from "@/src/api/client"
import type { ApiMeta } from "@/src/api/contracts"

import { formatDateTime } from "./format"

/** 页面级数据说明：滞后、部分成功、使用上一版等。 */
export function DataNotice({ meta, publishedAt, lagReason }: { meta: ApiMeta; publishedAt?: string | null; lagReason?: string | null }) {
  if (meta.dataState === "ready" && !meta.notice) return null
  const tone = meta.dataState === "ready" ? "info" : meta.dataState === "unavailable" ? "critical" : "warning"
  const title = meta.dataState === "stale"
    ? "数据已滞后，正在展示上一版完整数据"
    : meta.dataState === "partial"
      ? "本次数据集部分成功，部分指标暂不可用"
      : meta.dataState === "unpublished"
        ? "等待数据发布"
        : meta.dataState === "unavailable"
          ? "数据不可用"
          : "数据说明"
  return (
    <aside className={`data-notice ${tone}`} role="status">
      {meta.dataState === "stale" ? <Clock aria-hidden="true" size={16} /> : <AlertTriangle aria-hidden="true" size={16} />}
      <span>
        <strong>{title}</strong>
        {meta.dataState === "stale" && publishedAt ? <span>最后成功发布 {formatDateTime(publishedAt)}；已滞后 {Math.max(0, Math.floor((Date.now() - new Date(publishedAt).getTime()) / 3_600_000))} 小时。{lagReason ? `原因：${lagReason}` : null}</span> : null}
        {meta.dataState === "partial" && lagReason ? <span>{lagReason}。受影响指标显示为 “—”，不使用猜测值。</span> : null}
        {meta.notice ? <span>{meta.notice}</span> : null}
      </span>
    </aside>
  )
}

export function EmptyState({ title = "该数据窗口内没有记录", description, action }: { title?: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <Inbox aria-hidden="true" size={26} />
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  )
}

export function UnauthorizedPanel({ currentRole, requiredRole = "admin", capability }: { currentRole: string; requiredRole?: string; capability: string }) {
  return (
    <section className="state-panel warning" aria-live="polite">
      <span className="state-icon"><Lock aria-hidden="true" size={22} /></span>
      <div>
        <span className="eyebrow">NO ACCESS</span>
        <h3>当前角色无权{capability}</h3>
        <p>你的角色是 <strong>{currentRole === "admin" ? "管理员（admin）" : "员工（viewer）"}</strong>，该操作需要 <strong>{requiredRole === "admin" ? "管理员（admin）" : requiredRole}</strong>。页面其余内容保持只读可见。</p>
      </div>
    </section>
  )
}

/**
 * 把 API 错误翻译成业务人员能理解的说明，并保留当前筛选条件的刷新入口。
 */
export function ErrorState({ error, retryHref, context }: { error: unknown; retryHref: string; context?: string }) {
  if (isApiError(error)) {
    if (error.code === "DATASET_UNPUBLISHED") {
      return (
        <section className="state-panel warning" role="alert">
          <span className="state-icon"><DatabaseZap aria-hidden="true" size={22} /></span>
          <div>
            <span className="eyebrow">DATASET PENDING</span>
            <h3>等待数据发布</h3>
            <p>{error.message}。为避免把未知结果显示成 0，{context ?? "本页"}暂不展示任何指标。</p>
            <p className="state-actions"><Link href="/data-quality">查看同步与数据质量</Link><Link href={retryHref}><RefreshCw aria-hidden="true" size={13} /> 安全刷新</Link></p>
          </div>
        </section>
      )
    }
    if (error.code === "FORBIDDEN") {
      return <UnauthorizedPanel currentRole="viewer" capability="执行该操作" />
    }
    if (error.code === "NOT_FOUND") {
      return (
        <section className="state-panel neutral" role="alert">
          <span className="state-icon"><Inbox aria-hidden="true" size={22} /></span>
          <div><span className="eyebrow">NOT FOUND</span><h3>没有找到对应记录</h3><p>{error.message}</p><p className="state-actions"><Link href={retryHref}>返回列表</Link></p></div>
        </section>
      )
    }
    return (
      <section className="state-panel critical" role="alert">
        <span className="state-icon"><ShieldAlert aria-hidden="true" size={22} /></span>
        <div>
          <span className="eyebrow">API {error.status}</span>
          <h3>{error.code === "UPSTREAM_UNAVAILABLE" ? "无法连接售后数据服务" : "数据服务返回错误"}</h3>
          <p>{error.message}。已保留当前筛选条件，可安全刷新；不会重放任何写入操作。</p>
          <p className="state-meta">错误码 <code>{error.code}</code>{error.requestId ? <> · 请求 ID <code>{error.requestId}</code></> : null}</p>
          <p className="state-actions"><Link href={retryHref}><RefreshCw aria-hidden="true" size={13} /> 安全刷新</Link><Link href="/data-quality">查看数据质量</Link></p>
        </div>
      </section>
    )
  }
  const message = error instanceof Error ? error.message : "未知错误"
  return (
    <section className="state-panel critical" role="alert">
      <span className="state-icon"><AlertTriangle aria-hidden="true" size={22} /></span>
      <div>
        <span className="eyebrow">PAGE ERROR</span>
        <h3>页面暂时无法读取数据</h3>
        <p>{message}</p>
        <p className="state-actions"><Link href={retryHref}><RefreshCw aria-hidden="true" size={13} /> 安全刷新</Link></p>
      </div>
    </section>
  )
}
