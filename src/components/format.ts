import type { CheckStatus, ClassificationStatus, DataState, Metric, MetricStatus, RunStatus, SourceSystem, WarehouseMatchStatus } from "@/src/api/contracts"

const countFormatter = new Intl.NumberFormat("zh-CN")
const percentFormatters = new Map<number, Intl.NumberFormat>()
const deltaFormatter = new Intl.NumberFormat("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: "exceptZero" })
const signedCountFormatter = new Intl.NumberFormat("zh-CN", { signDisplay: "exceptZero" })
const moneyFormatter = new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", minimumFractionDigits: 2 })
const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})
const shortDateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})

export const EMPTY = "—"

export function formatCount(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY
  return countFormatter.format(Math.round(value))
}

export function formatSignedCount(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY
  return signedCountFormatter.format(Math.round(value))
}

export function formatPercent(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY
  const formatter = percentFormatters.get(digits) ?? new Intl.NumberFormat("zh-CN", {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
  percentFormatters.set(digits, formatter)
  return formatter.format(value / 100)
}

/** 百分点差异按团队习惯直接显示为 `%`，例如 `+0.36%`。 */
export function formatDelta(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY
  return `${deltaFormatter.format(value)}%`
}

export function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY
  return moneyFormatter.format(value)
}

export function formatMetric(metric: Metric | null | undefined, kind: "count" | "percent" = "count") {
  if (!metric || metric.value === null) return EMPTY
  return kind === "percent" ? formatPercent(metric.value) : formatCount(metric.value)
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return EMPTY
  const date = new Date(value.replace(" ", "T"))
  return Number.isNaN(date.getTime()) ? EMPTY : dateTimeFormatter.format(date)
}

export function formatShortDateTime(value: string | null | undefined) {
  if (!value) return EMPTY
  const date = new Date(value.replace(" ", "T"))
  return Number.isNaN(date.getTime()) ? EMPTY : shortDateTimeFormatter.format(date)
}

export function formatDate(value: string | null | undefined) {
  if (!value) return EMPTY
  return value.slice(0, 10)
}

export function formatDuration(ms: number | null | undefined) {
  if (ms === null || ms === undefined) return EMPTY
  if (ms < 60_000) return `${Math.round(ms / 1000)} 秒`
  const minutes = Math.floor(ms / 60_000)
  const seconds = Math.round((ms % 60_000) / 1000)
  return seconds ? `${minutes} 分 ${seconds} 秒` : `${minutes} 分`
}

export function formatHoursAgo(hours: number | null | undefined) {
  if (hours === null || hours === undefined) return EMPTY
  if (hours < 1) return "1 小时内"
  if (hours < 48) return `${Math.floor(hours)} 小时前`
  return `${Math.floor(hours / 24)} 天前`
}

export function sourceLabel(source: SourceSystem | string | null | undefined) {
  switch (source) {
    case "banniu": return "班牛"
    case "ticket_service": return "新工单"
    case "external_db": return "外部数据库"
    case null:
    case undefined: return "平台任务"
    default: return source
  }
}

export function runStatusLabel(status: RunStatus) {
  const labels: Record<RunStatus, string> = {
    pending: "等待中",
    running: "运行中",
    succeeded: "成功",
    partial: "部分成功",
    failed: "失败",
    unknown: "结果未知",
    awaiting_confirmation: "等待人工确认",
  }
  return labels[status]
}

export function runStatusTone(status: RunStatus): "neutral" | "good" | "warning" | "critical" {
  if (status === "succeeded") return "good"
  if (status === "failed") return "critical"
  if (status === "partial" || status === "unknown" || status === "awaiting_confirmation") return "warning"
  return "neutral"
}

export function checkStatusLabel(status: CheckStatus) {
  const labels: Record<CheckStatus, string> = { passed: "通过", warning: "提示", failed: "未通过", skipped: "未执行" }
  return labels[status]
}

export function checkStatusTone(status: CheckStatus): "neutral" | "good" | "warning" | "critical" {
  if (status === "passed") return "good"
  if (status === "failed") return "critical"
  if (status === "warning") return "warning"
  return "neutral"
}

export function classificationLabel(status: ClassificationStatus) {
  const labels: Record<ClassificationStatus, string> = { included: "已纳入", excluded: "可剔除", unclassified: "待归类" }
  return labels[status]
}

export function classificationTone(status: ClassificationStatus): "neutral" | "good" | "warning" | "critical" {
  if (status === "included") return "good"
  if (status === "unclassified") return "warning"
  return "neutral"
}

export function warehouseMatchLabel(status: WarehouseMatchStatus) {
  const labels: Record<WarehouseMatchStatus, string> = { confirmed: "已确认映射", auto: "自动映射", pending: "待映射", none: "无仓库信息" }
  return labels[status]
}

export function dataStateLabel(state: DataState) {
  const labels: Record<DataState, string> = { ready: "数据正常", stale: "数据已滞后", partial: "部分成功", unpublished: "等待数据发布", unavailable: "数据不可用" }
  return labels[state]
}

export function dataStateTone(state: DataState): "neutral" | "good" | "warning" | "critical" {
  if (state === "ready") return "good"
  if (state === "unavailable") return "critical"
  return "warning"
}

export function metricStatusLabel(status: MetricStatus) {
  const labels: Record<MetricStatus, string> = { ready: "已就绪", partial: "部分", stale: "滞后", unavailable: "不可用" }
  return labels[status]
}
