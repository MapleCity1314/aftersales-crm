import Image from "next/image"
import { cookies } from "next/headers"
import Link from "next/link"
import { Suspense, type ReactNode } from "react"

import brandMark from "@/public/brand/yuyuan-mark-dark.png"
import { mockScenarios } from "@/src/api/adapters/mock"
import { isApiError } from "@/src/api/client"
import { getApi, MOCK_SCENARIO_COOKIE, resolveApiMode } from "@/src/api/server"
import { currentUser } from "@/src/auth/current-user"

import { AppNavigation } from "./app-navigation"
import { DemoControls } from "./demo-controls"
import { formatShortDateTime } from "./format"
import { DataStateBadge } from "./status-badge"

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <aside className="sidebar">
        <div className="brand">
          <Image className="brand-mark" src={brandMark} alt="" aria-hidden="true" sizes="40px" preload />
          <span><strong>榆园售后</strong><small>售后经营平台</small></span>
        </div>
        <Suspense fallback={null}><AppNavigation /></Suspense>
        <div className="sidebar-note">
          <Suspense fallback={<span className="live-dot" />}><SidebarMode /></Suspense>
        </div>
      </aside>
      <main className="main-content" id="main-content">
        <header className="topbar">
          <div className="topbar-title">
            <span className="eyebrow">AFTERSALES OPERATIONS</span>
            <h1>售后经营平台</h1>
          </div>
          <Suspense fallback={<div className="topbar-status skeleton" aria-label="正在读取数据集状态"><span className="skeleton-line short" /><span className="skeleton-line short" /></div>}>
            <TopbarStatus />
          </Suspense>
          <Suspense fallback={<div aria-label="正在读取员工身份" className="viewer viewer-skeleton"><span className="avatar" /><span /></div>}>
            <CurrentUserViewer />
          </Suspense>
        </header>
        {children}
      </main>
    </div>
  )
}

async function SidebarMode() {
  const mode = resolveApiMode()
  return (
    <>
      <span className={mode === "mock" ? "live-dot pending" : "live-dot"} />
      <span>{mode === "mock" ? "受控样例数据 · 未接真实来源" : "Hono /api/v1 · 已发布数据集"}</span>
    </>
  )
}

async function loadTopbarStatus() {
  try {
    const api = await getApi()
    const { data, meta } = await api.dataStatus()
    return { ok: true as const, version: meta.datasetVersion, publishedAt: data.dataset.publishedAt, state: meta.dataState }
  } catch (error) {
    return { ok: false as const, code: isApiError(error) ? error.code : null }
  }
}

async function TopbarStatus() {
  const status = await loadTopbarStatus()
  if (!status.ok) {
    return (
      <div className="topbar-status">
        <span className="status-chip">
          <small>数据状态</small>
          <strong>{status.code ? `不可用（${status.code}）` : "不可用"}</strong>
        </span>
      </div>
    )
  }
  return (
    <div className="topbar-status">
      <Link className="status-chip" href="/data-quality" title="当前发布的数据集版本">
        <small>数据集</small>
        <strong>{status.version ?? "未发布"}</strong>
      </Link>
      <span className="status-chip">
        <small>最后更新</small>
        <strong>{formatShortDateTime(status.publishedAt)}</strong>
      </span>
      <DataStateBadge state={status.state} />
    </div>
  )
}

async function CurrentUserViewer() {
  const user = await currentUser()
  const mode = resolveApiMode()
  const scenario = mode === "mock" ? ((await cookies()).get(MOCK_SCENARIO_COOKIE)?.value ?? "default") : null
  return (
    <div className="viewer-block">
      {mode === "mock" ? <DemoControls role={user.role} scenario={scenario ?? "default"} scenarios={mockScenarios} /> : null}
      <div className="viewer">
        <span className="avatar">{user.displayName.slice(0, 1)}</span>
        <span><strong>{user.displayName}</strong><small>{user.role === "admin" ? "管理员 · admin" : "员工 · viewer"}</small></span>
      </div>
    </div>
  )
}
