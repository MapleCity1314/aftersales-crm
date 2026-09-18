import { CalendarClock, ChevronLeft, ChevronRight, Database, GitCommitHorizontal, ShieldCheck } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"

import type { ApiSuccess, DataStatusData, ListData, RunStatus, SourceStatus, SourceSystem, SyncRunFilters, SyncRunSummary } from "@/src/api/contracts"
import { buildHref, first, type SearchParams } from "@/src/api/query"
import { getApi } from "@/src/api/server"
import { formatCount, formatDate, formatDateTime, formatDuration, formatHoursAgo, formatShortDateTime, runStatusLabel, sourceLabel } from "@/src/components/format"
import { RouteLoading } from "@/src/components/route-loading"
import { DataNotice, EmptyState, ErrorState } from "@/src/components/state-panels"
import { Badge, CheckStatusBadge, RunStatusBadge, SourceTag } from "@/src/components/status-badge"

export const metadata = { title: "同步与数据质量 · 榆园售后经营平台" }

type Props = { searchParams: Promise<SearchParams> }

const runStatuses: RunStatus[] = ["pending", "running", "succeeded", "partial", "failed", "unknown", "awaiting_confirmation"]
const runSources: SourceSystem[] = ["external_db", "banniu", "ticket_service"]

export default function DataQualityPage(props: Props) {
  return <Suspense fallback={<RouteLoading />}><DataQualityContent {...props} /></Suspense>
}

function runFiltersFromSearch(query: SearchParams): { filters: SyncRunFilters; page: number } {
  const source = first(query, "source")
  const status = first(query, "status")
  const page = Math.max(1, Number(first(query, "page") ?? "1") || 1)
  const limit = 10
  return {
    page,
    filters: {
      source: runSources.includes(source as SourceSystem) ? (source as SourceSystem) : "all",
      status: runStatuses.includes(status as RunStatus) ? (status as RunStatus) : "all",
      offset: (page - 1) * limit,
      limit,
    },
  }
}

async function DataQualityContent({ searchParams }: Props) {
  const query = await searchParams
  const { filters, page } = runFiltersFromSearch(query)
  const runHref = (extra: Record<string, string | undefined>) =>
    buildHref("/data-quality", [], {
      source: filters.source === "all" ? undefined : filters.source,
      status: filters.status === "all" ? undefined : filters.status,
      page: page > 1 ? String(page) : undefined,
      ...extra,
    })
  const selfHref = runHref({})

  let status: ApiSuccess<DataStatusData> | null = null
  let runs: ApiSuccess<ListData<SyncRunSummary>> | null = null
  let error: unknown = null
  try {
    const api = await getApi()
    ;[status, runs] = await Promise.all([api.dataStatus(), api.syncRuns(filters)])
  } catch (caught) {
    error = caught
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">SYNC & DATA QUALITY</span>
          <h2>同步与数据质量</h2>
          <p>数据集能否发布，由必需质量检查决定。这里回答三个问题：数据新不新、来源全不全、失败了怎么恢复。</p>
        </div>
      </div>

      {error || !status || !runs ? (
        <ErrorState error={error} retryHref={selfHref} context="数据质量" />
      ) : (
        <>
          <DataNotice meta={status.meta} publishedAt={status.data.dataset.publishedAt} lagReason={status.data.lag.reason} />

          <section className="two-col" style={{ marginTop: 0 }}>
            <article className="panel">
              <div className="panel-heading">
                <div><span className="eyebrow">PUBLISHED DATASET</span><h3>当前可读数据集</h3></div>
                <Badge tone={status.data.dataset.state === "published" ? "good" : status.data.dataset.state === "failed" ? "critical" : "warning"}>
                  {{ published: "已发布", failed: "发布失败", pending_checks: "等待质量检查", superseded: "已被替代" }[status.data.dataset.state]}
                </Badge>
              </div>
              <dl className="dataset-card">
                <div><small>数据集版本</small><strong className="mono">{status.data.dataset.publishedAt ? status.data.dataset.version : "未发布"}</strong></div>
                <div><small>发布时间</small><strong>{formatDateTime(status.data.dataset.publishedAt)}</strong></div>
                <div><small>覆盖窗口</small><strong>{formatDate(status.data.dataset.coverageStart)} 至 {formatDate(status.data.dataset.coverageEnd)}</strong></div>
                <div><small>规则版本</small><strong className="mono">{status.data.dataset.ruleVersion}</strong></div>
                <div><small>滞后</small><strong className={status.data.lag.hours !== null && status.data.lag.hours > 24 ? "number-up" : undefined}>{status.data.lag.hours === null ? "—" : `${status.data.lag.hours} 小时`}</strong></div>
                <div><small>交界时间</small><strong>{formatDateTime(status.data.dataset.cutoverAt)} {status.data.dataset.cutoverAt ? <Badge tone={status.data.dataset.cutoverConfirmed ? "good" : "warning"}>{status.data.dataset.cutoverConfirmed ? "已确认" : "待确认"}</Badge> : null}</strong></div>
                <div><small>必需检查</small><strong>{status.data.dataset.requiredChecksPassed ? "全部通过" : "未全部通过"}</strong></div>
                <div>
                  <small>发布时限</small>
                  <strong className={status.data.scheduleDeadline.met === false ? "number-up" : undefined}>
                    {status.data.scheduleDeadline.met === null ? "未评估" : status.data.scheduleDeadline.met ? "已达成" : "未达成"}
                  </strong>
                  <small>{status.data.scheduleDeadline.label}</small>
                </div>
              </dl>
              <div className="breakdown" style={{ marginTop: 14 }}>
                {status.data.dataset.sourceBreakdown.map((entry) => (
                  <span key={entry.sourceSystem}><SourceTag source={entry.sourceSystem} /> {formatCount(entry.rows)} 行</span>
                ))}
              </div>
            </article>

            <article className="panel">
              <div className="panel-heading">
                <div><span className="eyebrow">LATEST ATTEMPT</span><h3>最近一次发布尝试</h3></div>
                {status.data.latestAttempt ? (
                  <Badge tone={status.data.latestAttempt.state === "published" ? "good" : status.data.latestAttempt.state === "failed" ? "critical" : "warning"}>
                    {{ published: "已发布", failed: "被质量门槛阻断", pending_checks: "等待质量检查", superseded: "已被替代" }[status.data.latestAttempt.state]}
                  </Badge>
                ) : null}
              </div>
              {status.data.latestAttempt ? (
                <>
                  <dl className="dataset-card" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                    <div><small>尝试版本</small><strong className="mono">{status.data.latestAttempt.version}</strong></div>
                    <div><small>尝试时间</small><strong>{formatDateTime(status.data.latestAttempt.attemptedAt)}</strong></div>
                  </dl>
                  {status.data.latestAttempt.failedChecks.length ? (
                    <div className="missing-list" role="note">
                      <strong>未通过的必需检查</strong>
                      {status.data.latestAttempt.failedChecks.map((check) => <span key={check}><code>{check}</code></span>)}
                      <span>页面继续使用上一版已发布数据集；不会把失败批次的部分结果混入。</span>
                    </div>
                  ) : (
                    <p className="advice" style={{ marginTop: 12 }}><strong>没有未通过的必需检查</strong>{status.data.latestAttempt.state === "pending_checks" ? "质量检查执行完成后自动发布。" : "该版本已成为当前可读数据集。"}</p>
                  )}
                </>
              ) : (
                <EmptyState title="还没有发布尝试" />
              )}
            </article>
          </section>

          <section className="source-cards" style={{ marginTop: 14 }} aria-label="来源同步状态">
            {status.data.sources.map((source) => <SourceCard key={source.sourceSystem} source={source} />)}
          </section>

          <article className="panel" style={{ marginTop: 14 }}>
            <div className="panel-heading">
              <div><span className="eyebrow">QUALITY GATES</span><h3>质量检查</h3><p>标记为“必需”的检查未通过时，数据集不发布，页面保持上一版。</p></div>
              <span className="muted">{status.data.checks.filter((check) => check.status === "passed").length} / {status.data.checks.length} 通过</span>
            </div>
            <div className="check-list">
              {status.data.checks.map((check) => (
                <div className={`check-row ${check.status}`} key={check.checkId}>
                  <div className="cell-stack">
                    <CheckStatusBadge status={check.status} />
                    <small>{check.required ? "必需" : "参考"} · {formatShortDateTime(check.checkedAt)}</small>
                  </div>
                  <div>
                    <strong>{check.label}</strong>
                    <small>{check.summary}{check.runId ? <> · <Link className="inline-link" href={`/data-quality/runs/${check.runId}`}>运行 {check.runId}</Link></> : null}</small>
                  </div>
                  <div className="measure">
                    {check.measured ?? "—"}
                    {check.threshold ? <small style={{ display: "block" }}>阈值 {check.threshold}</small> : null}
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="panel" style={{ marginTop: 14 }}>
            <div className="panel-heading">
              <div><span className="eyebrow">SYNC RUNS</span><h3>同步运行记录</h3><p>每次运行记录窗口、读写行数和错误摘要。失败运行进入详情查看重跑建议。</p></div>
              <form className="run-filters" action="/data-quality" method="get">
                <label>
                  <span className="sr-only">来源</span>
                  <select defaultValue={filters.source ?? "all"} name="source">
                    <option value="all">全部来源</option>
                    {runSources.map((source) => <option key={source} value={source}>{sourceLabel(source)}</option>)}
                  </select>
                </label>
                <label>
                  <span className="sr-only">状态</span>
                  <select defaultValue={filters.status ?? "all"} name="status">
                    <option value="all">全部状态</option>
                    {runStatuses.map((value) => <option key={value} value={value}>{runStatusLabel(value)}</option>)}
                  </select>
                </label>
                <button className="button small" type="submit">筛选</button>
              </form>
            </div>

            {runs.data.items.length === 0 ? (
              <EmptyState title="没有符合条件的运行记录" action={<Link className="inline-link" href="/data-quality">清除筛选</Link>} />
            ) : (
              <div className="table-scroll">
                <table className="runs-table">
                  <thead>
                    <tr>
                      <th scope="col">运行</th>
                      <th scope="col">来源 / 触发</th>
                      <th scope="col">数据窗口</th>
                      <th scope="col">状态</th>
                      <th className="num" scope="col">读取</th>
                      <th className="num" scope="col">写入 / 更新</th>
                      <th className="num" scope="col">耗时</th>
                      <th scope="col">开始时间</th>
                      <th scope="col">错误</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.data.items.map((run) => (
                      <tr className={run.status === "failed" ? "failed-row" : undefined} key={run.runId}>
                        <td>
                          <div className="cell-stack">
                            <Link className="row-link" href={`/data-quality/runs/${run.runId}`}>{run.runId}</Link>
                            <small>{run.task}</small>
                          </div>
                        </td>
                        <td>
                          <div className="cell-stack">
                            <SourceTag source={run.sourceSystem} />
                            <small>{{ schedule: "定时", manual: "手动", backfill: "补数", publish: "发布" }[run.trigger]}</small>
                          </div>
                        </td>
                        <td className="mono">{formatDate(run.windowStart)} → {formatDate(run.windowEnd)}</td>
                        <td><RunStatusBadge status={run.status} /></td>
                        <td className="num">{formatCount(run.readRows)}</td>
                        <td className="num">{formatCount(run.writtenRows)} / {formatCount(run.updatedRows)}</td>
                        <td className="num">{formatDuration(run.durationMs)}</td>
                        <td>{formatShortDateTime(run.startedAt)}</td>
                        <td>{run.errorCode ? <span className="cell-stack"><code>{run.errorCode}</code><small>{run.errorSummary}</small></span> : <span className="empty-value">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <RunPagination total={runs.data.total} offset={runs.data.offset} limit={runs.data.limit} page={page} hrefFor={(next) => runHref({ page: next > 1 ? String(next) : undefined })} />
          </article>
        </>
      )}
    </>
  )
}

function SourceCard({ source }: { source: SourceStatus }) {
  const Icon = source.sourceSystem === "external_db" ? Database : source.sourceSystem === "banniu" ? GitCommitHorizontal : ShieldCheck
  return (
    <article className="source-card">
      <header>
        <div>
          <h3><Icon aria-hidden="true" size={16} style={{ verticalAlign: -3, marginRight: 6 }} />{source.label}</h3>
          <p>{source.role}</p>
        </div>
        <RunStatusBadge status={source.status} />
      </header>
      <dl>
        <div><dt>最后运行</dt><dd>{formatShortDateTime(source.lastRunAt)}</dd></div>
        <div><dt>最后成功</dt><dd>{formatShortDateTime(source.lastSuccessAt)}</dd></div>
        <div><dt>覆盖窗口</dt><dd>{source.coverageStart ? `${formatDate(source.coverageStart)} → ${formatDate(source.coverageEnd)}` : "—"}</dd></div>
        <div><dt>节奏</dt><dd><CalendarClock aria-hidden="true" size={12} style={{ verticalAlign: -2, marginRight: 4 }} />{{ daily: "每日", weekly: "每周", unobserved: "未观测" }[source.cadence]}</dd></div>
        <div><dt>读取 / 写入</dt><dd>{formatCount(source.readRows)} / {formatCount(source.writtenRows)}</dd></div>
        <div><dt>滞后</dt><dd className={source.lagHours !== null && source.lagHours > 24 ? "number-up" : undefined}>{formatHoursAgo(source.lagHours)}</dd></div>
      </dl>
      {source.note ? <p className="note">{source.note}</p> : null}
    </article>
  )
}

function RunPagination({ total, offset, limit, page, hrefFor }: { total: number; offset: number; limit: number; page: number; hrefFor: (page: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / limit))
  const from = total === 0 ? 0 : offset + 1
  const to = Math.min(total, offset + limit)
  return (
    <div className="table-footer">
      <span>显示 <strong>{from}–{to}</strong> / {formatCount(total)} 次运行</span>
      <nav className="pagination" aria-label="运行记录分页">
        {page > 1 ? <Link href={hrefFor(page - 1)} aria-label="上一页"><ChevronLeft aria-hidden="true" size={14} /></Link> : <span aria-disabled="true"><ChevronLeft aria-hidden="true" size={14} /></span>}
        <span aria-current="page" style={{ color: "var(--ink)" }}>{page} / {pages}</span>
        {page < pages ? <Link href={hrefFor(page + 1)} aria-label="下一页"><ChevronRight aria-hidden="true" size={14} /></Link> : <span aria-disabled="true"><ChevronRight aria-hidden="true" size={14} /></span>}
      </nav>
    </div>
  )
}
