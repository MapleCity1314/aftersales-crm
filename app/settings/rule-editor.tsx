"use client"

import { ChevronRight, Pencil, Power, PowerOff } from "lucide-react"
import Link from "next/link"
import { useActionState, useId, useState } from "react"

import type { ExclusionRule } from "@/src/api/contracts"
import { issuesHref } from "@/src/api/query"
import { formatDateTime } from "@/src/components/format"
import { Badge } from "@/src/components/status-badge"

import { idleRuleActionState } from "./action-state"
import { updateExclusionRule } from "./actions"

export function RuleCard({ rule, canEdit, week }: { rule: ExclusionRule; canEdit: boolean; week?: string }) {
  const [state, action, pending] = useActionState(updateExclusionRule, idleRuleActionState)
  const [editing, setEditing] = useState(false)
  const noteId = useId()
  const message = state.ruleId === rule.ruleId ? state : null

  return (
    <article className={rule.enabled ? "rule-card" : "rule-card disabled"} aria-busy={pending}>
      <div>
        <div className="rule-path">
          <strong>{rule.p1}</strong>
          <ChevronRight aria-hidden="true" size={12} />
          <span>{rule.p2}</span>
          <ChevronRight aria-hidden="true" size={12} />
          <span>{rule.p3}</span>
          <Badge tone={rule.enabled ? "good" : "neutral"}>{rule.enabled ? "剔除中" : "已停用"}</Badge>
        </div>
        {editing ? (
          <form action={action} className="rule-form" style={{ marginTop: 10 }}>
            <input name="ruleId" type="hidden" value={rule.ruleId} />
            <input name="intent" type="hidden" value="note" />
            <label className="sr-only" htmlFor={noteId}>剔除说明</label>
            <textarea defaultValue={rule.note} id={noteId} maxLength={200} name="note" placeholder="说明为什么这条路径不计入经营异常" />
            <div className="rule-form-actions">
              <button className="button small" disabled={pending} onClick={() => setEditing(false)} type="button">取消</button>
              <button className="button small primary" disabled={pending} type="submit">{pending ? "保存中…" : "保存说明"}</button>
            </div>
          </form>
        ) : (
          <p className="rule-note">{rule.note || <span className="empty-value">未填写说明</span>}</p>
        )}
        <p className="rule-meta">
          <code>{rule.ruleId}</code> · 最近由 {rule.updatedBy ?? "系统初始化"} 于 {formatDateTime(rule.updatedAt)} 更新 ·{" "}
          <Link className="inline-link" href={issuesHref({ p1: rule.p1, p2: rule.p2, p3: rule.p3, week })}>查看命中问题</Link>
        </p>
        {message?.message ? <p className={`rule-message ${message.status}`} role="status">{message.message}</p> : null}
      </div>
      {canEdit ? (
        <div className="rule-actions">
          <form action={action}>
            <input name="ruleId" type="hidden" value={rule.ruleId} />
            <input name="intent" type="hidden" value={rule.enabled ? "disable" : "enable"} />
            <button className="button small" disabled={pending} type="submit">
              {rule.enabled ? <><PowerOff aria-hidden="true" size={13} /> 停用剔除</> : <><Power aria-hidden="true" size={13} /> 启用剔除</>}
            </button>
          </form>
          {!editing ? (
            <button className="button small" disabled={pending} onClick={() => setEditing(true)} type="button"><Pencil aria-hidden="true" size={13} /> 编辑说明</button>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}
