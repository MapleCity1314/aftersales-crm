import { CalendarClock, Database, HardDriveDownload, ServerCog } from "lucide-react"
import Link from "next/link"

import type { DataStatusData, DatasetSummary, QualityCheck, SourceStatus, SyncRunSummary } from "@/src/api/contracts"

import { EMPTY, formatCount, formatDateTime, formatDuration, formatHoursAgo, formatShortDateTime } from "./format"
import { EmptyState } from "./state-panels"
import { Badge, CheckStatusBadge, RunStatusBadge, SourceTag } from "./status-badge"

const sourceIcons = { external_db: Database, banniu: HardDriveDownload, ticket_service: ServerCog } as const

const cadenceLabel = { daily: "日更", weekly: "周更", unobserved: "更新频率待观察" } as const

export function SourceCards({ sources }: { sources: SourceStatus[] }) {
  return (
    <section className="source-cards" aria-label="数据源状态">
      {sources.map((source) => {
        const Icon = sourceIcons[source.sourceSystem]
        return (
          <article key={source.sourceSystem} className="source-card">
            <header>
              <div>
                <h3 style={{ display: "flex", gap: 8, alignItems: "center" }}><Icon aria-hidden="true" size={16} /> {source.label}</h3>
                <p>{source.role}</p>
              </div>
              <RunStatusBadge status={source.status} />
            </header>
            <dl>
              <div><dt>最新同步</dt><dd>{formatDateTime(source.lastRunAt)}</dd></div>
              <div><dt>最后成功</dt><dd>{formatDateTime(source.lastSuccessAt)}</dd></div>
              <div><dt>覆盖窗口</dt><dd>{source.coverageStart ? `${formatShortDateTime(source.coverageStart)} → ${formatShortDateTime(source.coverageEnd)}` : EMPTY}</dd></div>
              <div><dt>调度</dt><dd>{cadenceLabel[source.cadence]}{source.lagHours !== null ? ` · 滞后 ${formatHoursAgo(source.lagHours)}` : ""}</dd></div>
              <div><dt>读取行数</dt><dd>{formatCount(source.readRows)}</dd></div>
              <div><dt>写入行数</dt><dd>{formatCount(source.writtenRows)}</dd></div>
            </dl>
            {source.note ? <p className="note">{source.note}</p> : null}
          </article>
        )
      })}
    </section>
  )
}

export function DatasetCard({ dataset, latestAttempt, lag, deadline }: { dataset: DatasetSummary; latestAttempt: DataStatusData["latestAttempt"]; lag: DataStatusData["lag"]; deadline: DataStatusData["scheduleDeadline"] }) {
  return (
    <article className="panel">
      <div className="panel-heading">
        <div><span className="eyebrow">PUBLISHED DATASET</span><h3>当前发布数据集</h3><p>页面只读取最近一个 published 且通过必需质量检查的版本。</p></div>
        <Badge tone={dataset.requiredChecksPassed ? "good" : "critical"}>{dataset.requiredChecksPassed ? "必需检查全部通过" : "必需检查未通过"}</Badge>
      </div>
      <div className="dataset-card">
        <div><small>版本</small><strong className="mono">{dataset.version}</strong></div>
        <div><small>发布时间</small><strong>{formatDateTime(dataset.publishedAt)}</strong></div>
        <div><small>覆盖起止</small><strong>{dataset.coverageStart} → {dataset.coverageEnd}</strong></div>
        <div><small>规则版本</small><strong className="mono">{dataset.ruleVersion}</strong></div>
        <div>
          <small>来源构成</small>
          <span className="breakdown">{dataset.sourceBreakdown.map((entry) => <span key={entry.sourceSystem}><SourceTag source={entry.sourceSystem} /> {formatCount(entry.rows)} 行</span>)}</span>
        </div>
        <div>
          <small>班牛 → 新工单 交界（cutover_at）</small>
          <strong>{dataset.cutoverAt ? formatDateTime(dataset.cutoverAt) : EMPTY} {dataset.cutoverConfirmed ? <Badge tone="good">已确认</Badge> : <Badge tone="warning">样例值，待业务确认</Badge>}</strong>
        </div>
        <div>
          <small>周一 15:00 截止</small>
          <strong style={{ display: "flex", gap: 6, alignItems: "center" }}><CalendarClock aria-hidden="true" size={14} /> {deadline.label} {deadline.met === null ? <Badge>待判定</Badge> : deadline.met ? <Badge tone="good">已达成</Badge> : <Badge tone="critical">未达成</Badge>}</strong>
        </div>
        <div>
          <small>滞后</small>
          <strong>{lag.hours === null ? "未滞后" : formatHoursAgo(lag.hours)}</strong>
          {lag.reason ? <small>{lag.reason}</small> : null}
        </div>
      </div>
      {latestAttempt && latestAttempt.version !== dataset.version ? (
        <div className="missing-list" role="note" style={{ marginTop: 14 }}>
          <strong>最新尝试 {latestAttempt.version} 未发布（{formatDateTime(latestAttempt.attemptedAt)}）</strong>
          <span>状态 {latestAttempt.state === "failed" ? "失败" : latestAttempt.state === "pending_checks" ? "等待质量检查" : latestAttempt.state}；未通过检查：{latestAttempt.failedChecks.join("、") || EMPTY}。旧版本继续可读，页面已标注“使用上一版”。</span>
        </div>
      ) : null}
    </article>
  )
}

export function QualityCheckList({ checks }: { checks: QualityCheck[] }) {
  if (checks.length === 0) return <EmptyState title="该版本没有质量检查记录" description="数据集发布前必须先运行质量检查；没有记录说明该版本尚未进入发布流程。" />
  return (
    <div className="check-list">
      {checks.map((check) => (
        <div key={check.checkId} className={`check-row ${check.status === "failed" ? "failed" : check.status === "warning" ? "warning" : ""}`}>
          <div>
            <CheckStatusBadge status={check.status} />
            <small>{check.required ? "必需" : "参考"}</small>
          </div>
          <div>
            <strong>{check.label}</strong>
            <small>{check.summary}</small>
            <small>检查于 {formatDateTime(check.checkedAt)}{check.runId ? <> · 运行 <Link className="inline-link mono" href={`/data-quality/runs/${check.runId}`}>{check.runId}</Link></> : null}</small>
          </div>
          <div className="measure">
            {check.measured ?? EMPTY}
            <small style={{ display: "block", color: "var(--muted)" }}>门槛 {check.threshold ?? EMPTY}</small>
          </div>
        </div>
      ))}
    </div>
  )
}

const triggerLabel: Record<SyncRunSummary["trigger"], string> = { schedule: "定时", manual: "手动", backfill: "补数", publish: "发布" }

export function SyncRunTable({ runs }: { runs: SyncRunSummary[] }) {
  if (runs.length === 0) return <EmptyState title="没有匹配的同步运行" description="放宽来源或状态筛选后再试。" />
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>运行 ID</th>
            <th>任务</th>
            <th>来源</th>
            <th>触发</th>
            <th>数据窗口</th>
            <th>状态</th>
            <th>开始 / 耗时</th>
            <th className="num">读取</th>
            <th className="num">写入 / 更新 / 跳过</th>
            <th>错误</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.runId}>
              <td><Link className="row-link mono" href={`/data-quality/runs/${run.runId}`}>{run.runId}</Link></td>
              <td>
                <div className="cell-stack">
                  <strong>{run.task}</strong>
                  {run.datasetVersion ? <small className="mono">{run.datasetVersion}</small> : null}
                </div>
              </td>
              <td>{run.sourceSystem ? <SourceTag source={run.sourceSystem} /> : <span className="muted">平台</span>}</td>
              <td>{triggerLabel[run.trigger]}</td>
              <td className="mono" style={{ fontSize: 11 }}>{formatShortDateTime(run.windowStart)} → {formatShortDateTime(run.windowEnd)}</td>
              <td><RunStatusBadge status={run.status} /></td>
              <td>
                <div className="cell-stack">
                  <span>{formatShortDateTime(run.startedAt)}</span>
                  <small>{run.finishedAt ? formatDuration(run.durationMs) : "进行中"}</small>
                </div>
              </td>
              <td className="num">{formatCount(run.readRows)}</td>
              <td className="num">{formatCount(run.writtenRows)} / {formatCount(run.updatedRows)} / {formatCount(run.skippedRows)}</td>
              <td style={{ maxWidth: 220 }}>
                {run.errorCode ? (
                  <div className="cell-stack">
                    <code style={{ color: "var(--critical)" }}>{run.errorCode}</code>
                    <small title={run.errorSummary ?? undefined}>{run.errorSummary}</small>
                  </div>
                ) : <span className="muted">{EMPTY}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
