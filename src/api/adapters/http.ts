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
