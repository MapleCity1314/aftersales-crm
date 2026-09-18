import { describe, expect, it } from "vitest"

import { createMockApiClient } from "@/src/api/adapters/mock"
import { isApiError } from "@/src/api/client"

const admin = { userId: "u-admin", displayName: "管理员", role: "admin" as const }
const viewer = { userId: "u-viewer", displayName: "员工", role: "viewer" as const }

describe("mock adapter honours the /api/v1 contract", () => {
  it("returns list metadata with total, paging and dataset version", async () => {
    const api = createMockApiClient({ identity: viewer })
    const result = await api.issues({ limit: 10, offset: 10 })
    expect(result.data.items.length).toBeLessThanOrEqual(10)
    expect(result.data.offset).toBe(10)
    expect(result.data.total).toBeGreaterThan(result.data.items.length)
    expect(result.meta.datasetVersion).toMatch(/^ds-/)
    expect(result.meta.dataState).toBe("ready")
  })

  it("keeps the audit identity: all issues = included + excluded + unclassified", async () => {
    const api = createMockApiClient({ identity: viewer })
    const { data } = await api.issues({ limit: 100 })
    expect(data.audit.included + data.audit.excluded + data.audit.unclassified).toBe(data.audit.total)
    expect(data.audit.total).toBe(data.total)
  })

  it("keeps product ranking consistent with matched operating issues", async () => {
    const api = createMockApiClient({ identity: viewer })
    const { data } = await api.productsWeekly()
    const ranked = data.rows.reduce((sum, row) => sum + row.currentIssues, 0)
    expect(ranked).toBe(data.matchedIssues)
    expect(data.matchedIssues + data.unmatchedIssues).toBe(data.totalOperatingIssues)
    expect(data.rows.every((row) => row.merchantCode.length > 0)).toBe(true)
  })

  it("never fabricates denominators for unmapped warehouses", async () => {
    const api = createMockApiClient({ identity: viewer })
    const { data } = await api.warehouses()
    const unmapped = data.rows.filter((row) => row.matchStatus === "pending" || row.matchStatus === "none")
    expect(unmapped.length).toBeGreaterThan(0)
    for (const row of unmapped) {
      expect(row.orders.value).toBeNull()
      expect(row.rate.value).toBeNull()
      expect(row.orders.status).toBe("unavailable")
    }
  })

  it("exposes source evidence and sync run for every issue row", async () => {
    const api = createMockApiClient({ identity: viewer })
    const { data } = await api.issues({ limit: 10 })
    const detail = await api.issue(data.items[0].ticketItemId)
    expect(detail.data.sourceSystem).toMatch(/^(banniu|ticket_service)$/)
    expect(detail.data.syncRun.runId).toBe(data.items[0].sourceRunId)
    expect(detail.data.rawPayload).toBeNull()
    const run = await api.syncRun(detail.data.syncRun.runId)
    expect(run.data.runId).toBe(detail.data.syncRun.runId)
  })

  it("only returns raw payloads to admins", async () => {
    const api = createMockApiClient({ identity: admin })
    const { data } = await api.issues({ limit: 1 })
    const detail = await api.issue(data.items[0].ticketItemId)
    expect(detail.data.rawPayload).not.toBeNull()
  })

  it("refuses to show numbers when no dataset is published", async () => {
    const api = createMockApiClient({ identity: viewer, scenario: "unpublished" })
    await expect(api.overview()).rejects.toSatisfy((error: unknown) => isApiError(error) && error.code === "DATASET_UNPUBLISHED")
  })

  it("serves the previous published version with a stale flag when the latest batch failed", async () => {
    const api = createMockApiClient({ identity: viewer, scenario: "stale" })
    const result = await api.overview()
    expect(result.meta.dataState).toBe("stale")
    expect(result.data.kpis.allIssues.value).not.toBeNull()
  })

  it("reports missing denominators as null rather than zero", async () => {
    const api = createMockApiClient({ identity: viewer, scenario: "partial" })
    const result = await api.overview({ period: "progress" })
    expect(result.meta.dataState).toBe("partial")
    expect(result.data.kpis.orders.value).toBeNull()
    expect(result.data.kpis.operatingRate.value).toBeNull()
    expect(result.data.kpis.operatingRate.reason).toBeTruthy()
    expect(result.data.kpis.allIssues.value).not.toBeNull()
  })

  it("rejects rule edits from viewers and records republish requirement for admins", async () => {
    const viewerApi = createMockApiClient({ identity: viewer })
    const rules = await viewerApi.rules()
    const target = rules.data.exclusionRules[0]
    await expect(viewerApi.updateRule(target.ruleId, { enabled: !target.enabled })).rejects.toSatisfy((error: unknown) => isApiError(error) && error.code === "FORBIDDEN")

    const adminApi = createMockApiClient({ identity: admin })
    const updated = await adminApi.updateRule(target.ruleId, { enabled: !target.enabled })
    expect(updated.data.requiresRepublish).toBe(true)
    expect(updated.data.lastChange?.by).toBe(admin.displayName)
  })
})
