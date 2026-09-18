import { describe, expect, it } from "vitest"

import { buildHref, issueFiltersFromSearch, issueFiltersToEntries, issuesHref } from "@/src/api/query"

describe("issue filters ⇄ URL", () => {
  it("parses search params into server-side filters with paging", () => {
    const filters = issueFiltersFromSearch({ week: "2026-09-07", source: "banniu", status: "included", page: "3", limit: "50", q: " 123 " })
    expect(filters).toMatchObject({ week: "2026-09-07", source: "banniu", status: "included", q: "123", offset: 100, limit: 50, sort: "created_desc" })
  })

  it("ignores invalid enum values instead of guessing", () => {
    const filters = issueFiltersFromSearch({ source: "excel", category: "其他", status: "maybe", sort: "random" })
    expect(filters.source).toBeUndefined()
    expect(filters.category).toBeUndefined()
    expect(filters.status).toBeUndefined()
    expect(filters.sort).toBe("created_desc")
  })

  it("clamps page size to the server contract", () => {
    expect(issueFiltersFromSearch({ limit: "5000" }).limit).toBe(100)
    expect(issueFiltersFromSearch({ limit: "1" }).limit).toBe(10)
    expect(issueFiltersFromSearch({ page: "-4" }).offset).toBe(0)
  })

  it("round-trips filters so a refreshed page reproduces the same query", () => {
    const original = issueFiltersFromSearch({ week: "2026-09-07", category: "库房问题", warehouse: "WH-HZ-01", merchant_code: "YY-XM-500", sort: "updated_desc" })
    const entries = issueFiltersToEntries(original)
    const reparsed = issueFiltersFromSearch(Object.fromEntries(entries))
    expect(reparsed).toEqual({ ...original, offset: 0, limit: 25 })
  })

  it("drops 'all' and empty values from hrefs", () => {
    expect(issuesHref({ source: "all", status: "included", q: "" })).toBe("/issues?status=included")
    expect(buildHref("/products", [["week", "2026-09-07"]], { sort: undefined })).toBe("/products?week=2026-09-07")
  })
})
