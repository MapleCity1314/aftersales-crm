import type { ClassificationStatus, IssueFilters, ProblemCategory, SourceSystem } from "./contracts"

export type SearchParams = Record<string, string | string[] | undefined>

export function first(params: SearchParams, key: string): string | undefined {
  const value = params[key]
  const text = Array.isArray(value) ? value[0] : value
  return text?.trim() ? text.trim() : undefined
}

const sources: Array<SourceSystem | "all"> = ["all", "external_db", "banniu", "ticket_service"]
const categories: Array<ProblemCategory | "待归类" | "all"> = ["all", "快递问题", "库房问题", "买家问题", "产品问题", "运营问题", "待归类"]
const statuses: Array<ClassificationStatus | "all"> = ["all", "included", "excluded", "unclassified"]

export function issueFiltersFromSearch(params: SearchParams): IssueFilters {
  const source = first(params, "source")
  const category = first(params, "category")
  const status = first(params, "status")
  const sort = first(params, "sort")
  const page = Math.max(1, Number(first(params, "page") ?? "1") || 1)
  const limit = Math.min(100, Math.max(10, Number(first(params, "limit") ?? "25") || 25))
  return {
    week: first(params, "week"),
    source: sources.includes(source as SourceSystem) ? (source as SourceSystem | "all") : undefined,
    shop: first(params, "shop"),
    product: first(params, "product"),
    merchantCode: first(params, "merchant_code"),
    productId: first(params, "product_id"),
    p1: first(params, "p1"),
    p2: first(params, "p2"),
    p3: first(params, "p3"),
    category: categories.includes(category as ProblemCategory) ? (category as IssueFilters["category"]) : undefined,
    status: statuses.includes(status as ClassificationStatus) ? (status as IssueFilters["status"]) : undefined,
    warehouse: first(params, "warehouse"),
    q: first(params, "q"),
    sort: sort === "created_asc" || sort === "updated_desc" ? sort : "created_desc",
    offset: (page - 1) * limit,
    limit,
  }
}

/** 把筛选条件写回 URL，保证刷新后可以复现。 */
export function issueFiltersToEntries(filters: IssueFilters): Array<[string, string]> {
  const entries: Array<[string, string]> = []
  const push = (key: string, value: string | number | undefined | null) => {
    if (value === undefined || value === null || value === "" || value === "all") return
    entries.push([key, String(value)])
  }
  push("week", filters.week)
  push("source", filters.source)
  push("shop", filters.shop)
  push("product", filters.product)
  push("merchant_code", filters.merchantCode)
  push("product_id", filters.productId)
  push("p1", filters.p1)
  push("p2", filters.p2)
  push("p3", filters.p3)
  push("category", filters.category)
  push("status", filters.status)
  push("warehouse", filters.warehouse)
  push("q", filters.q)
  if (filters.sort && filters.sort !== "created_desc") push("sort", filters.sort)
  return entries
}

export function buildHref(pathname: string, entries: Array<[string, string]>, extra: Record<string, string | undefined> = {}) {
  const search = new URLSearchParams(entries)
  for (const [key, value] of Object.entries(extra)) {
    if (value === undefined || value === "") search.delete(key)
    else search.set(key, value)
  }
  const text = search.toString()
  return text ? `${pathname}?${text}` : pathname
}

export function issuesHref(filters: Partial<IssueFilters>, extra: Record<string, string | undefined> = {}) {
  return buildHref("/issues", issueFiltersToEntries({ ...filters, offset: undefined, limit: undefined }), extra)
}
