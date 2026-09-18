import { ArrowLeft, FileSearch, ListChecks, RotateCcw, ScrollText } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"

import type { ApiSuccess, SyncRunDetail } from "@/src/api/contracts"
import { issuesHref } from "@/src/api/query"
import { getApi } from "@/src/api/server"
import { formatCount, formatDate, formatDateTime, formatDuration, formatShortDateTime, sourceLabel } from "@/src/components/format"
import { RouteLoading } from "@/src/components/route-loading"
import { EmptyState, ErrorState } from "@/src/components/state-panels"
import { Badge, RunStatusBadge, SourceTag } from "@/src/components/status-badge"

type Props = { params: Promise<{ runId: string }> }

export async function generateMetadata({ params }: Props) {
  const { runId } = await params
  return { title: `运行 ${runId} · 榆园售后经营平台` }
}

export default function RunDetailPage(props: Props) {
  return <Suspense fallback={<RouteLoading variant="detail" />}><RunDetailContent {...props} /></Suspense>
}

async function RunDetailContent({ params }: Props) {
  const { runId } = await params
  let result: ApiSuccess<SyncRunDetail> | null = null
  let error: unknown = null
  try {
    const api = await getApi()
    result = await api.syncRun(runId)
  } catch (caught) {
    error = caught
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <Link className="back-link" href="/data-quality"><ArrowLeft aria-hidden="true" size={14} /> 返回同步与数据质量</Link>
          <span className="eyebrow">SYNC RUN</span>
          <h2 className="mono-title">{runId}</h2>
          {result ? <p>{result.data.task} · {sourceLabel(result.data.sourceSystem)} · {{ schedule: "定时触发", manual: "手动触发", backfill: "补数任务", publish: "发布任务" }[result.data.trigger]}</p> : null}
        </div>
        {result ? <div className="page-heading-actions"><RunStatusBadge status={result.data.status} /></div> : null}
      </div>

      {error || !result ? <ErrorState error={error} retryHref="/data-quality" context="运行详情" /> : <RunDetail run={result.data} />}
    </>
  )
}

function RunDetail({ run }: { run: SyncRunDetail }) {
  const incompletePages = run.pages.filter((page) => !page.complete).length
  return (
    <div className="run-detail-grid">
      <div className="stack">
        <article className="panel">
          <div className="panel-heading"><div><span className="eyebrow">SUMMARY</span><h3>运行摘要</h3></div><SourceTag source={run.sourceSystem} /></div>
          <dl className="dataset-card">
            <div><small>数据窗口</small><strong className="mono">{formatDate(run.windowStart)} → {formatDate(run.windowEnd)}</strong></div>
            <div><small>开始 / 结束</small><strong>{formatShortDateTime(run.startedAt)} → {formatShortDateTime(run.finishedAt)}</strong></div>
            <div><small>耗时</small><strong>{formatDuration(run.durationMs)}</strong></div>
            <div><small>数据集版本</small><strong className="mono">{run.datasetVersion ?? "未产生"}</strong></div>
            <div><small>读取</small><strong>{formatCount(run.readRows)}</strong></div>
            <div><small>写入 / 更新</small><strong>{formatCount(run.writtenRows)} / {formatCount(run.updatedRows)}</strong></div>
            <div><small>跳过</small><strong>{formatCount(run.skippedRows)}</strong></div>
            <div><small>影响工单 / 周</small><strong>{formatCount(run.affectedTickets)} · {run.affectedWeeks.length ? run.affectedWeeks.join("、") : "—"}</strong></div>
          </dl>
          {run.errorCode ? (
            <div className="missing-list" role="alert" style={{ marginTop: 14 }}>
              <strong>错误 <code>{run.errorCode}</code></strong>
              <span>{run.errorSummary}</span>
            </div>
          ) : null}
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div><span className="eyebrow">PAGES</span><h3>分页完整性</h3><p>每一页记录请求与响应摘要，缺页或重复页会阻断发布。</p></div>
            <Badge tone={incompletePages ? "critical" : "good"}>{incompletePages ? `${incompletePages} 页不完整` : `${run.pages.length} 页完整`}</Badge>
          </div>
          {run.pages.length === 0 ? (
            <EmptyState title="该运行没有分页记录" description="发布任务或外部数据库任务不按页读取。" />
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">页</th>
                    <th scope="col">请求摘要</th>
                    <th scope="col">响应摘要</th>
                    <th className="num" scope="col">读取</th>
                    <th className="num" scope="col">重复</th>
                    <th scope="col">完整</th>
                  </tr>
                </thead>
                <tbody>
                  {run.pages.map((page) => (
                    <tr key={page.pageNo}>
                      <td className="num">{page.pageNo}</td>
                      <td className="mono">{page.requestDigest}</td>
                      <td className="mono">{page.responseDigest}</td>
                      <td className="num">{formatCount(page.readRows)}</td>
                      <td className="num">{page.duplicateRows ? <span className="number-up">{formatCount(page.duplicateRows)}</span> : 0}</td>
                      <td><Badge tone={page.complete ? "good" : "critical"}>{page.complete ? "完整" : "缺失"}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="panel">
          <div className="panel-heading"><div><span className="eyebrow">LOGS</span><h3><ScrollText aria-hidden="true" size={16} style={{ verticalAlign: -2, marginRight: 6 }} />运行日志</h3></div></div>
          {run.logs.length === 0 ? <EmptyState title="没有日志" /> : (
            <ol className="log-list">
              {run.logs.map((log, index) => (
                <li key={`${log.at}-${index}`}>
                  <span className="muted">{formatShortDateTime(log.at)}</span>
                  <span className={log.level === "info" ? undefined : log.level}>{log.level.toUpperCase()}</span>
                  <span>{log.message}</span>
                </li>
              ))}
            </ol>
          )}
        </article>
      </div>

      <div className="stack">
        <article className="panel">
          <div className="panel-heading"><div><span className="eyebrow">RECOVERY</span><h3><RotateCcw aria-hidden="true" size={16} style={{ verticalAlign: -2, marginRight: 6 }} />恢复建议</h3></div></div>
          {run.status === "unknown" ? (
            <div className="missing-list" role="alert" style={{ marginBottom: 12 }}>
              <strong>需要人工核对</strong>
              <span>该运行的副作用未知：无法确认写入是否完成或是否重复。请先按下方证据核对写入范围，再决定是否重跑；页面不提供直接重试入口。</span>
            </div>
          ) : null}
          <p className={run.retrySafe === false ? "advice unsafe" : "advice"}>
            <strong>{run.retrySafe === null ? "重跑安全性未评估，需要人工核对" : run.retrySafe ? "可以安全重跑" : "不要直接重跑"}</strong>
            {run.recoveryAdvice}
          </p>
          <p className="muted" style={{ marginTop: 10 }}>重跑与补数由后端任务执行；页面只展示结论与证据，不发起写入。</p>
        </article>

        {run.dryRun ? (
          <article className="panel">
            <div className="panel-heading"><div><span className="eyebrow">DRY RUN</span><h3><ListChecks aria-hidden="true" size={16} style={{ verticalAlign: -2, marginRight: 6 }} />补数预览</h3><p>写入前的差异统计，用于人工确认。</p></div></div>
            <div className="dry-run">
              <div><small>新增</small><strong>{formatCount(run.dryRun.added)}</strong></div>
              <div><small>更新</small><strong>{formatCount(run.dryRun.updated)}</strong></div>
              <div><small>不变</small><strong>{formatCount(run.dryRun.unchanged)}</strong></div>
              <div><small>来源消失</small><strong className={run.dryRun.missing ? "number-up" : undefined}>{formatCount(run.dryRun.missing)}</strong></div>
              <div><small>重复</small><strong className={run.dryRun.duplicates ? "number-up" : undefined}>{formatCount(run.dryRun.duplicates)}</strong></div>
              <div><small>跨源疑似</small><strong className={run.dryRun.crossSourceSuspects ? "number-up" : undefined}>{formatCount(run.dryRun.crossSourceSuspects)}</strong></div>
              <div><small>未匹配</small><strong>{formatCount(run.dryRun.unmatched)}</strong></div>
            </div>
          </article>
        ) : null}

        <article className="panel">
          <div className="panel-heading"><div><span className="eyebrow">EVIDENCE</span><h3><FileSearch aria-hidden="true" size={16} style={{ verticalAlign: -2, marginRight: 6 }} />证据样本</h3><p>点击进入问题工作台查看对应问题行。</p></div></div>
          {run.evidenceSamples.length === 0 ? <EmptyState title="该运行没有证据样本" /> : (
            <ul className="evidence-list">
              {run.evidenceSamples.map((sample) => (
                <li key={sample.evidenceId}>
                  <Link className="row-link" href={issuesHref({}, { selected: sample.ticketItemId })}>{sample.ticketItemId}</Link>
                  <small className="mono">来源工单 {sample.sourceTicketId} · 证据 {sample.evidenceId}</small>
                </li>
              ))}
            </ul>
          )}
          <p className="muted" style={{ marginTop: 12 }}>运行开始于 {formatDateTime(run.startedAt)}。</p>
        </article>
      </div>
    </div>
  )
}
