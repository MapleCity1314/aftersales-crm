import { AlertTriangle, History } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"

import type { ApiSuccess, RulesData } from "@/src/api/contracts"
import { issuesHref } from "@/src/api/query"
import { getApi } from "@/src/api/server"
import { currentUser } from "@/src/auth/current-user"
import { formatDateTime } from "@/src/components/format"
import { RouteLoading } from "@/src/components/route-loading"
import { ErrorState, UnauthorizedPanel } from "@/src/components/state-panels"
import { Badge } from "@/src/components/status-badge"

import { RuleCard } from "./rule-editor"

export const metadata = { title: "规则设置 · 榆园售后经营平台" }

export default function SettingsPage() {
  return <Suspense fallback={<RouteLoading variant="detail" />}><SettingsContent /></Suspense>
}

async function SettingsContent() {
  const user = await currentUser()
  let result: ApiSuccess<RulesData> | null = null
  let error: unknown = null
  try {
    const api = await getApi()
    result = await api.rules()
  } catch (caught) {
    error = caught
  }
  const canEdit = user.role === "admin"

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">PROBLEM GOVERNANCE</span>
          <h2>问题分类与可剔除规则</h2>
          <p>五大分类由一级问题直接确定；可剔除规则按“一级 / 二级 / 三级”路径把不属于经营异常的问题移出统计口径。规则变更后需要重新计算并发布数据集。</p>
        </div>
        {result ? (
          <div className="page-heading-actions">
            <span className="status-chip"><small>当前规则版本</small><strong>{result.data.ruleVersion}</strong></span>
            <span className="status-chip"><small>已发布数据集使用</small><strong>{result.data.publishedRuleVersion}</strong></span>
          </div>
        ) : null}
      </div>

      {error || !result ? (
        <ErrorState error={error} retryHref="/settings" context="规则设置" />
      ) : (
        <>
          {result.data.requiresRepublish ? (
            <aside className="data-notice" role="status">
              <AlertTriangle aria-hidden="true" size={16} />
              <span>
                <strong>规则版本 {result.data.ruleVersion} 尚未反映到页面数据</strong>
                <span>已发布数据集仍使用 {result.data.publishedRuleVersion}。后端重新计算并通过质量检查后，经营总览、产品周报与仓库分析才会更新；期间页面不会混用两套口径。</span>
              </span>
            </aside>
          ) : null}

          {!canEdit ? <UnauthorizedPanel currentRole={user.role} capability="修改规则" /> : null}

          <article className="panel" style={{ marginTop: 14 }}>
            <div className="panel-heading">
              <div><span className="eyebrow">FIVE CATEGORIES</span><h3>五大问题分类</h3><p>分类不可在页面上新增或删除；未命中任何分类的问题显示为“待归类”。</p></div>
            </div>
            <div className="category-grid">
              {result.data.categories.map((category) => (
                <div className="category-card" key={category.category}>
                  <strong>{category.category}</strong>
                  <small>{category.description}</small>
                  <Badge tone={category.enabled ? "good" : "neutral"}>{category.enabled ? "启用" : "停用"}</Badge>
                  <Link className="inline-link" href={issuesHref({ category: category.category })}>查看该分类问题</Link>
                </div>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="panel-heading">
              <div><span className="eyebrow">EXCLUSION RULES</span><h3>可剔除规则</h3><p>{result.data.exclusionRules.filter((rule) => rule.enabled).length} 条剔除中 · {result.data.exclusionRules.filter((rule) => !rule.enabled).length} 条已停用</p></div>
              <Link className="inline-link" href={issuesHref({ status: "excluded" })}>查看全部可剔除问题</Link>
            </div>
            <div className="rule-list">
              {result.data.exclusionRules.map((rule) => <RuleCard canEdit={canEdit} key={rule.ruleId} rule={rule} />)}
            </div>
          </article>

          <article className="panel">
            <div className="panel-heading"><div><span className="eyebrow">CHANGE LOG</span><h3><History aria-hidden="true" size={16} style={{ verticalAlign: -2, marginRight: 6 }} />最近变更</h3></div></div>
            {result.data.lastChange ? (
              <p className="muted">{formatDateTime(result.data.lastChange.at)} · {result.data.lastChange.by} · {result.data.lastChange.summary}</p>
            ) : (
              <p className="muted">还没有规则变更记录。</p>
            )}
            <p className="muted" style={{ marginTop: 6 }}>完整审计记录由后端保存；页面只展示最近一次变更。</p>
          </article>
        </>
      )}
    </>
  )
}
