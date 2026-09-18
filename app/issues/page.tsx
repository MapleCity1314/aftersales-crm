import { Suspense } from "react"

import type { ApiSuccess, IssueDetail, IssueListData } from "@/src/api/contracts"
import { buildHref, first, issueFiltersFromSearch, issueFiltersToEntries, type SearchParams } from "@/src/api/query"
import { getApi } from "@/src/api/server"
import { currentUser } from "@/src/auth/current-user"
import { DatasetStrip } from "@/src/components/dataset-strip"
import { ExportButton } from "@/src/components/export-button"
import { formatCount } from "@/src/components/format"
import { IssueDrawer } from "@/src/components/issue-drawer"
import { ActiveFilters, IssueFilterForm } from "@/src/components/issue-filters"
import { IssueTable } from "@/src/components/issue-table"
import { RouteLoading } from "@/src/components/route-loading"
import { DataNotice, ErrorState } from "@/src/components/state-panels"

export const metadata = { title: "问题工作台 · 榆园售后经营平台" }

type Props = { searchParams: Promise<SearchParams> }

export default function IssuesPage(props: Props) {
  return <Suspense fallback={<RouteLoading variant="table" />}><IssuesContent {...props} /></Suspense>
}

async function IssuesContent({ searchParams }: Props) {
  const query = await searchParams
  const filters = issueFiltersFromSearch(query)
  const selectedId = first(query, "selected") ?? null
  const page = first(query, "page")
  const entries = issueFiltersToEntries(filters)
  const hrefWith = (extra: Record<string, string | undefined>) => buildHref("/issues", entries, { page, selected: selectedId ?? undefined, ...extra })
  const selfHref = hrefWith({})

  const user = await currentUser()
  let api: Awaited<ReturnType<typeof getApi>> | null = null
  let list: ApiSuccess<IssueListData> | null = null
  let detail: ApiSuccess<IssueDetail> | null = null
  let error: unknown = null
  let detailError: unknown = null
  try {
    api = await getApi()
    const [listResult, detailResult] = await Promise.all([
      api.issues(filters),
      selectedId ? api.issue(selectedId).catch((caught: unknown) => { detailError = caught; return null }) : Promise.resolve(null),
    ])
    list = listResult
    detail = detailResult
  } catch (caught) {
    error = caught
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ISSUE WORKBENCH</span>
          <h2>问题工作台</h2>
          <p>服务端分页的问题明细。每一行都能追溯到来源系统、来源工单 ID、同步批次和证据摘要。</p>
        </div>
        <div className="page-heading-actions">
          {api && list ? <ExportButton api={api} params={{ view: "issues", ...Object.fromEntries(entries), datasetVersion: list.meta.datasetVersion ?? "" }}>导出当前筛选</ExportButton> : null}
        </div>
      </div>

      {error || !list ? (
        <ErrorState error={error} retryHref={selfHref} context="问题工作台" />
      ) : (
        <>
          <DatasetStrip meta={list.meta} dataset={null} sources={null} windowLabel={filters.week ? `创建周 ${list.data.facets.weeks.find((week) => week.start === filters.week)?.label ?? filters.week}` : "全部已发布周期"} />
          <DataNotice meta={list.meta} />
          <IssueFilterForm filters={filters} facets={list.data.facets} />
          <ActiveFilters filters={filters} />

          <div className={`workbench${detail || detailError ? " with-drawer" : ""}`}>
            <section className="panel" aria-label="问题列表">
              <div className="result-scope">
                <span>结果 <strong>{formatCount(list.data.total)}</strong> 条 · 数据集 <strong className="mono">{list.meta.datasetVersion ?? "—"}</strong></span>
                <span className="audit-summary" aria-label="对账口径">
                  <span>已纳入 <strong>{formatCount(list.data.audit.included)}</strong></span>
                  <span>可剔除 <strong>{formatCount(list.data.audit.excluded)}</strong></span>
                  <span>待归类 <strong>{formatCount(list.data.audit.unclassified)}</strong></span>
                  <span>合计 = 全量 <strong>{list.data.audit.included + list.data.audit.excluded + list.data.audit.unclassified === list.data.audit.total ? "✓" : "不一致"}</strong></span>
                </span>
              </div>
              <IssueTable data={list.data} selectedId={selectedId} hrefWith={hrefWith} />
            </section>

            {detail ? (
              <IssueDrawer detail={detail.data} closeHref={hrefWith({ selected: undefined })} isAdmin={user.role === "admin"} />
            ) : detailError ? (
              <aside className="drawer" aria-label="详情加载失败">
                <ErrorState error={detailError} retryHref={hrefWith({ selected: undefined })} context="问题详情" />
              </aside>
            ) : null}
          </div>
        </>
      )}
    </>
  )
}
