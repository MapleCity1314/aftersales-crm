/**
 * Hono 接入契约（后端由 Codex 实现，前端只消费）。
 *
 * 启用方式：设置 `AFTERSALES_API_BASE_URL`（服务端直连地址）与可选的
 * `AFTERSALES_PUBLIC_API_BASE_URL`（浏览器可访问的导出地址）；未设置时页面使用受控样例数据。
 *
 * 请求头：`x-company-user-id` / `x-company-user-name`（URL 编码）/ `x-company-role`（admin | viewer），
 * 由公司网关注入的身份透传，Hono 需再次校验，不接受前端凭据。
 *
 * 端点 → 响应类型（见 ../contracts.ts）：
 *   GET   /readyz                                   → ReadinessData
 *   GET   /api/v1/overview?period&datasetVersion    → ApiSuccess<OverviewData>
 *   GET   /api/v1/issues?<IssueFilters 蛇形参数>     → ApiSuccess<IssueListData>（服务端分页，offset/limit）
 *   GET   /api/v1/issues/:id                        → ApiSuccess<IssueDetail>
 *   GET   /api/v1/products/weekly?week&datasetVersion → ApiSuccess<ProductWeeklyData>
 *   GET   /api/v1/warehouses?week&datasetVersion    → ApiSuccess<WarehouseData>
 *   GET   /api/v1/rules                             → ApiSuccess<RulesData>
 *   PATCH /api/v1/rules/:ruleId  body RuleUpdateInput → ApiSuccess<RulesData>（仅 admin，返回更新后的全量规则）
 *   GET   /api/v1/data-status                       → ApiSuccess<DataStatusData>
 *   GET   /api/v1/sync/runs?source&status&offset&limit → ApiSuccess<ListData<SyncRunSummary>>
 *   GET   /api/v1/sync/runs/:runId                  → ApiSuccess<SyncRunDetail>
 *   GET   /api/v1/export?<同 issues 参数>            → CSV 下载（浏览器直接打开）
 *
 * 成功响应统一为 `{ data, meta: ApiMeta }`，meta 含 requestId / datasetVersion / generatedAt / dataState / notice；
 * 错误响应为 `{ error: { code, message, details? } }`，code 取 ApiErrorCode 之一，
 * HTTP 状态码与之对应（401/403/404/422/409 DATASET_UNPUBLISHED/503/500）。
 * 每个响应建议携带 `x-request-id`，前端错误面板会展示它。
 */
import { ApiError, type ApiClient, type ApiClientContext, type ApiErrorCode } from "../client"
import type { ApiErrorBody, ApiSuccess, IssueFilters, ReadinessData, SyncRunFilters } from "../contracts"

const errorCodes: ApiErrorCode[] = [
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION_ERROR",
  "DATASET_UNPUBLISHED",
  "UPSTREAM_UNAVAILABLE",
  "INTERNAL_ERROR",
]

function toQuery(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue
    search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ""
}

function issueQuery(filters: IssueFilters) {
  return toQuery({
    week: filters.week,
    source: filters.source,
    shop: filters.shop,
    product: filters.product,
    merchant_code: filters.merchantCode,
    product_id: filters.productId,
    p1: filters.p1,
    p2: filters.p2,
    p3: filters.p3,
    category: filters.category,
    status: filters.status,
    warehouse: filters.warehouse,
    q: filters.q,
    sort: filters.sort,
    offset: filters.offset,
    limit: filters.limit,
  })
}

/**
 * 转发到 Hono 服务。员工身份通过公司网关注入的头部继续透传，
 * Hono 侧负责再次校验，前端不传角色以外的任何凭据。
 */
export function createHttpApiClient(baseUrl: string, publicBaseUrl: string | null, context: ApiClientContext): ApiClient {
  const origin = baseUrl.replace(/\/$/, "")

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${origin}${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-company-user-id": context.identity.userId,
        "x-company-user-name": encodeURIComponent(context.identity.displayName),
        "x-company-role": context.identity.role,
        ...(init?.headers ?? {}),
      },
    }).catch((cause: unknown) => {
      throw new ApiError("UPSTREAM_UNAVAILABLE", "无法连接售后数据服务", 503, cause)
    })

    const requestId = response.headers.get("x-request-id") ?? undefined
    if (!response.ok) {
      let body: ApiErrorBody | null = null
      try {
        body = (await response.json()) as ApiErrorBody
      } catch {
        body = null
      }
      const code = body?.error?.code
      throw new ApiError(
        (errorCodes as string[]).includes(code ?? "") ? (code as ApiErrorCode) : "INTERNAL_ERROR",
        body?.error?.message ?? `数据服务返回 ${response.status}`,
        response.status,
        body?.error?.details,
        requestId,
      )
    }
    return (await response.json()) as T
  }

  return {
    mode: "http",
    readiness: () => request<ReadinessData>("/readyz"),
    overview: (params = {}) => request<ApiSuccess<never>>(`/api/v1/overview${toQuery({ period: params.period, datasetVersion: params.datasetVersion })}`),
    issues: (filters) => request(`/api/v1/issues${issueQuery(filters)}`),
    issue: (id) => request(`/api/v1/issues/${encodeURIComponent(id)}`),
    productsWeekly: (params = {}) => request(`/api/v1/products/weekly${toQuery({ week: params.week, datasetVersion: params.datasetVersion })}`),
    warehouses: (params = {}) => request(`/api/v1/warehouses${toQuery({ week: params.week, datasetVersion: params.datasetVersion })}`),
    rules: () => request("/api/v1/rules"),
    updateRule: (ruleId, input) => request(`/api/v1/rules/${encodeURIComponent(ruleId)}`, { method: "PATCH", body: JSON.stringify(input) }),
    dataStatus: () => request("/api/v1/data-status"),
    syncRuns: (filters: SyncRunFilters) => request(`/api/v1/sync/runs${toQuery({ source: filters.source, status: filters.status, offset: filters.offset, limit: filters.limit })}`),
    syncRun: (runId) => request(`/api/v1/sync/runs/${encodeURIComponent(runId)}`),
    exportUrl: (params) => (publicBaseUrl ? `${publicBaseUrl.replace(/\/$/, "")}/api/v1/export${toQuery(params)}` : null),
  }
}
