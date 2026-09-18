import type {
  ApiSuccess,
  DataStatusData,
  IssueDetail,
  IssueFilters,
  IssueListData,
  OverviewData,
  ProductWeeklyData,
  ReadinessData,
  RequestIdentity,
  RuleUpdateInput,
  RulesData,
  SyncRunDetail,
  SyncRunFilters,
  SyncRunSummary,
  ListData,
  WarehouseData,
} from "./contracts"

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "DATASET_UNPUBLISHED"
  | "UPSTREAM_UNAVAILABLE"
  | "INTERNAL_ERROR"

export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status: number
  readonly details?: unknown
  readonly requestId?: string

  constructor(code: ApiErrorCode, message: string, status: number, details?: unknown, requestId?: string) {
    super(message)
    this.name = "ApiError"
    this.code = code
    this.status = status
    this.details = details
    this.requestId = requestId
  }
}

export interface OverviewParams {
  period?: "closed" | "progress"
  datasetVersion?: string
}

export interface ProductWeeklyParams {
  week?: string
  datasetVersion?: string
}

export interface WarehouseParams {
  week?: string
  datasetVersion?: string
}

/**
 * 页面唯一的数据入口。实现方式可替换：
 * - `mock`：进程内受控样例数据，用于演示和验收。
 * - `http`：转发到 Hono `/api/v1`。
 */
export interface ApiClient {
  readonly mode: "mock" | "http"
  readiness(): Promise<ReadinessData>
  overview(params?: OverviewParams): Promise<ApiSuccess<OverviewData>>
  issues(filters: IssueFilters): Promise<ApiSuccess<IssueListData>>
  issue(id: string): Promise<ApiSuccess<IssueDetail>>
  productsWeekly(params?: ProductWeeklyParams): Promise<ApiSuccess<ProductWeeklyData>>
  warehouses(params?: WarehouseParams): Promise<ApiSuccess<WarehouseData>>
  rules(): Promise<ApiSuccess<RulesData>>
  updateRule(ruleId: string, input: RuleUpdateInput): Promise<ApiSuccess<RulesData>>
  dataStatus(): Promise<ApiSuccess<DataStatusData>>
  syncRuns(filters: SyncRunFilters): Promise<ApiSuccess<ListData<SyncRunSummary>>>
  syncRun(runId: string): Promise<ApiSuccess<SyncRunDetail>>
  /** 导出链接与页面共用同一数据集版本；mock 模式下没有可下载的文件，返回 null。 */
  exportUrl(params: Record<string, string>): string | null
}

export interface ApiClientContext {
  identity: RequestIdentity
  /** 仅 mock 模式使用：演示不同数据状态。 */
  scenario?: string | null
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}
