/**
 * 页面与 Hono `/api/v1` 之间的共享契约。
 * 前端只依赖这里的类型；mock 适配器与 http 适配器都必须返回同样的结构。
 */

export type SourceSystem = "external_db" | "banniu" | "ticket_service"

export type MetricStatus = "ready" | "partial" | "stale" | "unavailable"

/** 所有指标都带状态；数值未知时 value 为 null，前端展示 `—`。 */
export interface Metric {
  value: number | null
  status: MetricStatus
  /** 数值缺失或不可用时的业务原因，例如“订单水位未到 09-16”。 */
  reason?: string | null
}

export type DataState = "ready" | "stale" | "partial" | "unpublished" | "unavailable"

export type RunStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "partial"
  | "failed"
  | "unknown"
  | "awaiting_confirmation"

export type CheckStatus = "passed" | "warning" | "failed" | "skipped"

export type ProblemCategory = "快递问题" | "库房问题" | "买家问题" | "产品问题" | "运营问题"

export type ClassificationStatus = "included" | "excluded" | "unclassified"

export type WarehouseMatchStatus = "confirmed" | "auto" | "pending" | "none"

export type EvidenceStatus = "verified" | "pending" | "missing"

export interface ApiMeta {
  requestId: string
  datasetVersion: string | null
  generatedAt: string
  dataState: DataState
  /** 页面级说明，例如“最新批次未通过质量检查，正在使用上一版”。 */
  notice?: string | null
}

export interface ApiSuccess<T> {
  data: T
  meta: ApiMeta
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown }
}

export interface ListData<T> {
  items: T[]
  total: number
  offset: number
  limit: number
}

export interface WeekWindow {
  start: string
  end: string
  label: string
}

export interface DatasetSummary {
  version: string
  state: "published" | "failed" | "pending_checks" | "superseded"
  publishedAt: string | null
  coverageStart: string
  coverageEnd: string
  sourceBreakdown: Array<{ sourceSystem: SourceSystem; rows: number }>
  requiredChecksPassed: boolean
  /** 数据集依赖的规则版本，规则变更后需要重新计算并发布。 */
  ruleVersion: string
  /** 班牛 → 新工单 交界时间，由配置提供，前端只展示。 */
  cutoverAt: string | null
  cutoverConfirmed: boolean
}

export interface SourceStatus {
  sourceSystem: SourceSystem
  label: string
  role: string
  lastRunAt: string | null
  lastSuccessAt: string | null
  coverageStart: string | null
  coverageEnd: string | null
  readRows: number | null
  writtenRows: number | null
  status: RunStatus
  cadence: "daily" | "weekly" | "unobserved"
  lagHours: number | null
  note?: string | null
}

export interface KpiMetric extends Metric {
  /** 相对上一完整周期的变化；百分比型指标为百分点差，计数型为差值。 */
  delta: number | null
  deltaKind: "count" | "pp"
  previousLabel: string
}

export interface TrendPoint {
  week: WeekWindow
  operatingIssues: Metric
  allIssues: Metric
  orders: Metric
  sales: Metric
  rate: Metric
  wow: Metric
  /** 该周由哪些来源构成，用于跨交界周提示。 */
  sources: SourceSystem[]
  reconciliation?: {
    banniu: number
    ticketService: number
    overlap: number
    missing: number
    suspectedDuplicates: number
    status: "pending" | "approved"
  } | null
}

export interface CategoryShare {
  category: ProblemCategory | "待归类"
  issues: number | null
  share: number | null
  delta: number | null
}

export interface ProductWatchRow {
  merchantCode: string
  productTitle: string
  productIdCount: number
  currentIssues: number
  previousIssues: number
  delta: number
  rate: Metric
}

export interface WarehouseRiskRow {
  warehouseCode: string
  warehouseName: string | null
  matchStatus: WarehouseMatchStatus
  currentIssues: number
  rate: Metric
  delta: number | null
}

export interface OverviewData {
  period: {
    mode: "closed" | "progress"
    current: WeekWindow
    previous: WeekWindow
    completedDays: number
    orderThrough: string | null
  }
  dataset: DatasetSummary
  sources: SourceStatus[]
  kpis: {
    allIssues: KpiMetric
    operatingIssues: KpiMetric
    unclassifiedIssues: KpiMetric
    excludedIssues: KpiMetric
    orders: KpiMetric
    sales: KpiMetric
    operatingRate: KpiMetric
    rateWow: KpiMetric
  }
  trend: TrendPoint[]
  categories: CategoryShare[]
  productWatchlist: ProductWatchRow[]
  warehouseRisk: WarehouseRiskRow[]
}

export interface IssueFilters {
  week?: string
  source?: SourceSystem | "all"
  shop?: string
  product?: string
  merchantCode?: string
  productId?: string
  p1?: string
  p2?: string
  p3?: string
  category?: ProblemCategory | "待归类" | "all"
  status?: ClassificationStatus | "all"
  warehouse?: string
  q?: string
  sort?: "created_desc" | "created_asc" | "updated_desc"
  offset?: number
  limit?: number
}

export interface IssueListItem {
  ticketItemId: string
  ticketId: string
  sourceSystem: SourceSystem
  sourceTicketId: string
  businessKey: string
  shopName: string | null
  status: string | null
  createdAt: string
  updatedAt: string | null
  productTitle: string | null
  merchantCode: string | null
  productId: string | null
  skuText: string | null
  orderId: string | null
  subOrderId: string | null
  quantity: number | null
  p1: string | null
  p2: string | null
  p3: string | null
  category: ProblemCategory | null
  classificationStatus: ClassificationStatus
  includedInOperating: boolean
  warehouseCode: string | null
  warehouseName: string | null
  warehouseMatchStatus: WarehouseMatchStatus
  trackingNo: string | null
  carrierName: string | null
  afterSalesAmount: number | null
  refundAmount: number | null
  paymentAt: string | null
  refundRequestedAt: string | null
  sourceRunId: string
  evidenceId: string | null
  evidenceStatus: EvidenceStatus
  crossSourceSuspect: boolean
}

export interface IssueFacets {
  weeks: WeekWindow[]
  shops: string[]
  warehouses: Array<{ code: string; name: string | null }>
  p1: string[]
  p2: string[]
  p3: string[]
}

export interface IssueListData extends ListData<IssueListItem> {
  facets: IssueFacets
  audit: {
    total: number
    included: number
    excluded: number
    unclassified: number
  }
}

export interface IssueDetail extends IssueListItem {
  evidence: {
    evidenceId: string
    rawRecordId: string
    contentHash: string
    observedAt: string
    requestWindowStart: string
    requestWindowEnd: string
    pageNo: number | null
    pageCursor: string | null
  } | null
  syncRun: {
    runId: string
    task: string
    status: RunStatus
    startedAt: string
    finishedAt: string | null
    windowStart: string
    windowEnd: string
  }
  /** 脱敏后的原始字段摘要，供所有角色查看。 */
  rawSummary: Array<{ field: string; value: string | null }>
  /** 仅管理员可获取的原始 JSON 文本；非管理员为 null。 */
  rawPayload: string | null
  missingFields: Array<{ field: string; reason: string }>
}

export interface ProductWeeklyRow {
  merchantCode: string
  productTitle: string
  productIdCount: number
  currentIssues: number
  previousIssues: number
  delta: number
  sources: SourceSystem[]
}

export interface ProductWeeklyData {
  selectedWeek: WeekWindow
  previousWeek: WeekWindow
  selectableWeeks: WeekWindow[]
  rows: ProductWeeklyRow[]
  matchedIssues: number
  unmatchedIssues: number
  totalOperatingIssues: number
  sourceBreakdown: Array<{ sourceSystem: SourceSystem; issues: number }>
  backfill: {
    status: "complete" | "preview_recorded" | "pending" | "not_started"
    note: string
  }
}

export interface WarehouseRow {
  warehouseCode: string
  warehouseName: string | null
  sourceSystem: SourceSystem
  matchStatus: WarehouseMatchStatus
  confidence: number | null
  currentIssues: number
  previousIssues: number
  orders: Metric
  rate: Metric
  previousRate: Metric
  deltaPp: number | null
}

export interface WarehouseData {
  week: WeekWindow
  previousWeek: WeekWindow
  selectableWeeks: WeekWindow[]
  rows: WarehouseRow[]
  pendingMappings: number
  totalWarehouseIssues: number
}

export interface ExclusionRule {
  ruleId: string
  p1: ProblemCategory
  p2: string
  p3: string
  note: string
  enabled: boolean
  updatedBy: string | null
  updatedAt: string | null
}

export interface RulesData {
  categories: Array<{ category: ProblemCategory; description: string; enabled: boolean; updatedBy: string | null; updatedAt: string | null }>
  exclusionRules: ExclusionRule[]
  ruleVersion: string
  publishedRuleVersion: string
  requiresRepublish: boolean
  lastChange: { by: string; at: string; summary: string } | null
}

export interface RuleUpdateInput {
  enabled?: boolean
  note?: string
}

export interface QualityCheck {
  checkId: string
  kind:
    | "page_completeness"
    | "duplicate_identity"
    | "source_disappearance"
    | "cutover_reconciliation"
    | "field_coverage"
    | "order_watermark"
    | "freshness"
  label: string
  status: CheckStatus
  required: boolean
  summary: string
  measured: string | null
  threshold: string | null
  checkedAt: string
  runId: string | null
}

export interface DataStatusData {
  dataset: DatasetSummary
  latestAttempt: {
    version: string
    state: DatasetSummary["state"]
    attemptedAt: string
    failedChecks: string[]
  } | null
  sources: SourceStatus[]
  checks: QualityCheck[]
  lag: { hours: number | null; reason: string | null }
  scheduleDeadline: { label: string; met: boolean | null }
}

export interface SyncRunFilters {
  source?: SourceSystem | "all"
  status?: RunStatus | "all"
  offset?: number
  limit?: number
}

export interface SyncRunSummary {
  runId: string
  task: string
  sourceSystem: SourceSystem | null
  trigger: "schedule" | "manual" | "backfill" | "publish"
  windowStart: string
  windowEnd: string
  status: RunStatus
  startedAt: string
  finishedAt: string | null
  durationMs: number | null
  readRows: number | null
  writtenRows: number | null
  updatedRows: number | null
  skippedRows: number | null
  errorCode: string | null
  errorSummary: string | null
  datasetVersion: string | null
}

export interface SyncRunPage {
  pageNo: number
  requestDigest: string
  responseDigest: string
  readRows: number
  duplicateRows: number
  complete: boolean
}

export interface SyncRunDetail extends SyncRunSummary {
  pages: SyncRunPage[]
  affectedTickets: number | null
  affectedWeeks: string[]
  retrySafe: boolean | null
  recoveryAdvice: string
  logs: Array<{ at: string; level: "info" | "warn" | "error"; message: string }>
  evidenceSamples: Array<{ evidenceId: string; sourceTicketId: string; ticketItemId: string }>
  dryRun: {
    added: number
    updated: number
    unchanged: number
    missing: number
    duplicates: number
    crossSourceSuspects: number
    unmatched: number
  } | null
}

export interface ReadinessData {
  ok: boolean
  database: "ok" | "unavailable"
  dataset: DatasetSummary | null
  freshness: DataState
  requiredChecksPassed: boolean
}

export interface RequestIdentity {
  userId: string
  displayName: string
  role: "admin" | "viewer"
}
