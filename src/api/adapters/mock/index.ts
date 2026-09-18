import { differenceInHours, format, parseISO, subDays } from "date-fns"

import { ApiError, type ApiClient, type ApiClientContext } from "../../client"
import type {
  ApiMeta,
  ApiSuccess,
  CategoryShare,
  DataState,
  DataStatusData,
  DatasetSummary,
  IssueDetail,
  IssueFilters,
  IssueListData,
  IssueListItem,
  KpiMetric,
  Metric,
  OverviewData,
  ProductWeeklyData,
  QualityCheck,
  ReadinessData,
  RulesData,
  SourceSystem,
  SyncRunDetail,
  SyncRunFilters,
  SyncRunSummary,
  TrendPoint,
  WarehouseData,
  WeekWindow,
  ListData,
} from "../../contracts"
import { categories, getWorld, products, rnd, warehouses, type MockWorld } from "./data"

export const mockScenarios = [
  { id: "default", label: "正常发布" },
  { id: "stale", label: "数据已滞后" },
  { id: "partial", label: "部分成功（缺订单分母）" },
  { id: "empty", label: "窗口内无数据" },
  { id: "unpublished", label: "数据集未发布" },
  { id: "error", label: "API 500" },
  { id: "slow", label: "慢响应（骨架屏）" },
] as const

export type MockScenario = (typeof mockScenarios)[number]["id"]

function normalizeScenario(value: string | null | undefined): MockScenario {
  return (mockScenarios.some((scenario) => scenario.id === value) ? value : "default") as MockScenario
}

/* 规则状态在进程内可变，用于演示“修改后需要重新发布”。 */
const ruleState: { rules: RulesData | null } = { rules: null }

function inWeek(item: IssueListItem, week: WeekWindow) {
  const day = item.createdAt.slice(0, 10)
  return day >= week.start && day < week.end
}

function ready(value: number | null, reason?: string | null): Metric {
  return value === null ? { value: null, status: "unavailable", reason: reason ?? null } : { value, status: "ready" }
}

function rateOf(issues: number | null, orders: Metric): Metric {
  if (issues === null || orders.value === null || orders.value === 0) {
    return { value: null, status: orders.status === "ready" ? "unavailable" : orders.status, reason: orders.reason ?? "分母不可用" }
  }
  return { value: Math.round((issues / orders.value) * 10000) / 100, status: orders.status }
}

function requestId() {
  return `req_${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`
}

export function createMockApiClient(context: ApiClientContext): ApiClient {
  const scenario = normalizeScenario(context.scenario)

  async function guard() {
    if (scenario === "slow") await new Promise((resolve) => setTimeout(resolve, 3200))
    if (scenario === "error") throw new ApiError("INTERNAL_ERROR", "读模型查询失败：business_overview_weekly 视图不存在", 500, { hint: "检查数据集发布任务" }, requestId())
  }

  function world(): MockWorld {
    const base = getWorld()
    if (scenario === "stale") {
      const publishedAt = new Date(base.now.getTime() - 38 * 3600_000).toISOString()
      const checks: QualityCheck[] = base.checks.map((check) => check.kind === "freshness"
        ? { ...check, status: "failed", summary: "已超过 24 小时未发布新数据集；上一版继续可读", measured: "38 小时前" }
        : check)
      return {
        ...base,
        publishedDataset: { ...base.publishedDataset, version: `ds-${format(subDays(base.today, 2), "yyyyMMdd")}-01`, publishedAt, coverageEnd: format(subDays(base.today, 3), "yyyy-MM-dd") },
        orderThrough: format(subDays(base.today, 3), "yyyy-MM-dd"),
        checks,
        sources: base.sources.map((source) => ({ ...source, status: source.sourceSystem === "external_db" ? "failed" : source.status, lagHours: 38, lastSuccessAt: publishedAt, note: source.sourceSystem === "external_db" ? "只读账号连接被拒绝（ECONNREFUSED），连续 2 次失败" : source.note })),
      }
    }
    if (scenario === "partial") {
      const through = format(subDays(base.today, 4), "yyyy-MM-dd")
      return {
        ...base,
        orderThrough: through,
        publishedDataset: { ...base.publishedDataset, coverageEnd: through },
        checks: base.checks.map((check) => check.kind === "order_watermark"
          ? { ...check, status: "failed", summary: `订单事实只覆盖到 ${through}，最近 3 天订单分母缺失`, measured: through }
          : check),
        sources: base.sources.map((source) => source.sourceSystem === "external_db" ? { ...source, status: "partial", coverageEnd: through, note: "光电通订单表最近 3 天尚未产出" } : source),
      }
    }
    if (scenario === "empty") {
      return { ...base, items: [] }
    }
    return base
  }

  function dataState(w: MockWorld): DataState {
    if (scenario === "unpublished") return "unpublished"
    if (scenario === "stale") return "stale"
    if (scenario === "partial") return "partial"
    return "ready"
  }

  function meta(w: MockWorld, notice?: string | null): ApiMeta {
    return {
      requestId: requestId(),
      datasetVersion: scenario === "unpublished" ? null : w.publishedDataset.version,
      generatedAt: new Date().toISOString(),
      dataState: dataState(w),
      notice: notice ?? (scenario === "default" ? `最新一次发布尝试 ${w.latestAttempt.version} 未通过必需质量检查，页面仍使用 ${w.publishedDataset.version}` : null),
    }
  }

  function requirePublished(w: MockWorld) {
    if (scenario === "unpublished") {
      throw new ApiError("DATASET_UNPUBLISHED", "当前没有通过质量检查的已发布数据集，等待数据发布", 409, { pendingVersion: w.latestAttempt.version }, requestId())
    }
  }

  function ordersFor(w: MockWorld, week: WeekWindow): Metric {
    const covered = week.end <= w.orderThrough || (week.start <= w.orderThrough && week.end > w.orderThrough && week.end <= format(w.today, "yyyy-MM-dd"))
    const value = w.storeOrdersByWeek.get(week.start) ?? null
    if (scenario === "partial" && week.end > w.orderThrough) {
      return { value: null, status: "partial", reason: `订单水位只到 ${w.orderThrough}，该周分母缺失` }
    }
    if (!covered && week.end > w.orderThrough) return { value: null, status: "unavailable", reason: `订单水位只到 ${w.orderThrough}` }
    return ready(value, "该周没有订单事实")
  }

  function salesFor(w: MockWorld, week: WeekWindow): Metric {
    const orders = ordersFor(w, week)
    if (orders.value === null) return orders
    return { value: w.storeSalesByWeek.get(week.start) ?? null, status: orders.status }
  }

  function weekItems(w: MockWorld, week: WeekWindow) {
    return w.items.filter((item) => inWeek(item, week))
  }

  function trendPoint(w: MockWorld, week: WeekWindow, previous: WeekWindow | null): TrendPoint {
    const items = weekItems(w, week)
    const operating = items.filter((item) => item.includedInOperating).length
    const orders = ordersFor(w, week)
    const rate = rateOf(operating, orders)
    let wow: Metric = { value: null, status: "unavailable", reason: "没有上一周期" }
    if (previous) {
      const prevRate = rateOf(weekItems(w, previous).filter((item) => item.includedInOperating).length, ordersFor(w, previous))
      wow = rate.value !== null && prevRate.value !== null
        ? { value: Math.round((rate.value - prevRate.value) * 100) / 100, status: rate.status }
        : { value: null, status: "unavailable", reason: rate.reason ?? prevRate.reason ?? "分母缺失" }
    }
    const sources = Array.from(new Set(items.map((item) => item.sourceSystem)))
    const isCutover = week.start === w.cutoverWeek.start
    return {
      week,
      operatingIssues: ready(items.length ? operating : items.length === 0 && scenario === "empty" ? null : operating, "窗口内无记录"),
      allIssues: ready(items.length === 0 && scenario === "empty" ? null : items.length, "窗口内无记录"),
      orders,
      sales: salesFor(w, week),
      rate,
      wow,
      sources,
      reconciliation: isCutover
        ? {
            banniu: items.filter((item) => item.sourceSystem === "banniu").length,
            ticketService: items.filter((item) => item.sourceSystem === "ticket_service").length,
            overlap: items.filter((item) => item.crossSourceSuspect).length,
            missing: 2,
            suspectedDuplicates: items.filter((item) => item.crossSourceSuspect).length,
            status: "pending",
          }
        : null,
    }
  }

  function kpi(current: Metric, previous: Metric, previousLabel: string, deltaKind: "count" | "pp" = "count"): KpiMetric {
    const delta = current.value !== null && previous.value !== null ? Math.round((current.value - previous.value) * 100) / 100 : null
    return { ...current, delta, deltaKind, previousLabel }
  }

  function respond<T>(w: MockWorld, data: T, notice?: string | null): ApiSuccess<T> {
    return { data, meta: meta(w, notice) }
  }

  return {
    mode: "mock",

    async readiness(): Promise<ReadinessData> {
      const w = world()
      return {
        ok: scenario === "default",
        database: scenario === "error" ? "unavailable" : "ok",
        dataset: scenario === "unpublished" ? null : w.publishedDataset,
        freshness: dataState(w),
        requiredChecksPassed: w.checks.filter((check) => check.required).every((check) => check.status === "passed"),
      }
    },

    async overview(params = {}) {
      await guard()
      const w = world()
      requirePublished(w)
      const mode = params.period === "progress" ? "progress" : "closed"
      const current = mode === "progress" ? w.currentWeek : w.trendWeeks[w.trendWeeks.length - 1]
      const previous = mode === "progress"
        ? { start: format(subDays(parseISO(w.currentWeek.start), 7), "yyyy-MM-dd"), end: format(subDays(parseISO(w.currentWeek.end), 7), "yyyy-MM-dd"), label: `上周同期` }
        : w.trendWeeks[w.trendWeeks.length - 2]

      const cur = weekItems(w, current)
      const prev = weekItems(w, previous)
      const count = (items: IssueListItem[], predicate: (item: IssueListItem) => boolean): Metric =>
        scenario === "empty" ? { value: null, status: "unavailable", reason: "数据窗口内没有售后记录" } : ready(items.filter(predicate).length)

      const curOrders = ordersFor(w, current)
      const prevOrders = ordersFor(w, previous)
      const curRate = rateOf(cur.filter((item) => item.includedInOperating).length, curOrders)
      const prevRate = rateOf(prev.filter((item) => item.includedInOperating).length, prevOrders)

      const catShares: CategoryShare[] = [...categories, "待归类" as const].map((category) => {
        const match = (item: IssueListItem) => (category === "待归类" ? item.classificationStatus === "unclassified" : item.category === category && item.includedInOperating)
        const issues = scenario === "empty" ? null : cur.filter(match).length
        const prevIssues = scenario === "empty" ? null : prev.filter(match).length
        const base = category === "待归类" ? cur.length : cur.filter((item) => item.includedInOperating).length
        return { category, issues, share: issues !== null && base ? Math.round((issues / base) * 1000) / 10 : null, delta: issues !== null && prevIssues !== null ? issues - prevIssues : null }
      })

      const productWatchlist = products
        .filter((product) => product.merchantCode)
        .map((product) => {
          const nowIssues = cur.filter((item) => item.merchantCode === product.merchantCode && item.includedInOperating).length
          const prevIssues = prev.filter((item) => item.merchantCode === product.merchantCode && item.includedInOperating).length
          const orders: Metric = curOrders.value === null ? curOrders : ready(Math.round(product.weeklyOrders * (mode === "progress" ? w.currentWeek.completedDays / 7 : 1)))
          return { merchantCode: product.merchantCode!, productTitle: product.title, productIdCount: product.productIds.length, currentIssues: nowIssues, previousIssues: prevIssues, delta: nowIssues - prevIssues, rate: rateOf(nowIssues, orders) }
        })
        .sort((a, b) => b.currentIssues - a.currentIssues || b.delta - a.delta)
        .slice(0, 7)

      const warehouseRisk = warehouses.map((warehouse) => {
        const match = (item: IssueListItem) => item.category === "库房问题" && item.includedInOperating && (warehouse.code ? item.warehouseCode === warehouse.code : item.warehouseName === warehouse.name)
        const nowIssues = cur.filter(match).length
        const prevIssues = prev.filter(match).length
        const orders: Metric = warehouse.weeklyOrders === null
          ? { value: null, status: "unavailable", reason: "仓库未完成映射，不使用全店订单兜底" }
          : curOrders.value === null ? curOrders : ready(Math.round(warehouse.weeklyOrders * (mode === "progress" ? w.currentWeek.completedDays / 7 : 1)))
        return { warehouseCode: warehouse.code ?? `未映射:${warehouse.name}`, warehouseName: warehouse.name, matchStatus: warehouse.matchStatus, currentIssues: nowIssues, rate: rateOf(nowIssues, orders), delta: nowIssues - prevIssues }
      }).sort((a, b) => b.currentIssues - a.currentIssues)

      const data: OverviewData = {
        period: { mode, current, previous, completedDays: mode === "progress" ? w.currentWeek.completedDays : 7, orderThrough: w.orderThrough },
        dataset: w.publishedDataset,
        sources: w.sources,
        kpis: {
          allIssues: kpi(count(cur, () => true), count(prev, () => true), previous.label),
          operatingIssues: kpi(count(cur, (item) => item.includedInOperating), count(prev, (item) => item.includedInOperating), previous.label),
          unclassifiedIssues: kpi(count(cur, (item) => item.classificationStatus === "unclassified"), count(prev, (item) => item.classificationStatus === "unclassified"), previous.label),
          excludedIssues: kpi(count(cur, (item) => item.classificationStatus === "excluded"), count(prev, (item) => item.classificationStatus === "excluded"), previous.label),
          orders: kpi(curOrders, prevOrders, previous.label),
          sales: kpi(salesFor(w, current), salesFor(w, previous), previous.label),
          operatingRate: kpi(curRate, prevRate, previous.label, "pp"),
          rateWow: { ...(curRate.value !== null && prevRate.value !== null ? { value: Math.round((curRate.value - prevRate.value) * 100) / 100, status: curRate.status } : { value: null, status: "unavailable", reason: curRate.reason ?? prevRate.reason ?? "分母缺失" }), delta: null, deltaKind: "pp", previousLabel: previous.label },
        },
        trend: w.trendWeeks.map((week, index) => trendPoint(w, week, index === 0 ? w.closedWeeks[0] : w.trendWeeks[index - 1])),
        categories: catShares,
        productWatchlist,
        warehouseRisk,
      }
      return respond(w, data)
    },

    async issues(filters) {
      await guard()
      const w = world()
      requirePublished(w)
      const weeks = [...w.trendWeeks, w.currentWeek]
      let rows = w.items
      const week = filters.week ? weeks.find((candidate) => candidate.start === filters.week) : null
      if (week) rows = rows.filter((item) => inWeek(item, week))
      if (filters.source && filters.source !== "all") rows = rows.filter((item) => item.sourceSystem === filters.source)
      if (filters.shop) rows = rows.filter((item) => item.shopName === filters.shop)
      if (filters.product) rows = rows.filter((item) => item.productTitle?.includes(filters.product!))
      if (filters.merchantCode) rows = rows.filter((item) => filters.merchantCode === "__unmatched__" ? !item.merchantCode : item.merchantCode === filters.merchantCode)
      if (filters.productId) rows = rows.filter((item) => item.productId === filters.productId)
      if (filters.p1) rows = rows.filter((item) => item.p1 === filters.p1)
      if (filters.p2) rows = rows.filter((item) => item.p2 === filters.p2)
      if (filters.p3) rows = rows.filter((item) => item.p3 === filters.p3)
      if (filters.category && filters.category !== "all") rows = rows.filter((item) => filters.category === "待归类" ? item.classificationStatus === "unclassified" : item.category === filters.category)
      if (filters.status && filters.status !== "all") rows = rows.filter((item) => item.classificationStatus === filters.status)
      if (filters.warehouse) rows = rows.filter((item) => item.warehouseCode === filters.warehouse || (filters.warehouse!.startsWith("未映射:") && item.warehouseName === filters.warehouse!.slice(4)))
      if (filters.q) {
        const q = filters.q.trim().toLowerCase()
        rows = rows.filter((item) => [item.sourceTicketId, item.orderId, item.subOrderId, item.trackingNo, item.productTitle, item.merchantCode, item.productId, item.p2, item.p3].some((value) => value?.toLowerCase().includes(q)))
      }
      if (filters.sort === "created_asc") rows = [...rows].sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1))
      if (filters.sort === "updated_desc") rows = [...rows].sort((a, b) => ((a.updatedAt ?? "") < (b.updatedAt ?? "") ? 1 : -1))

      const limit = Math.min(100, Math.max(10, filters.limit ?? 25))
      const offset = Math.max(0, filters.offset ?? 0)
      const data: IssueListData = {
        items: rows.slice(offset, offset + limit),
        total: rows.length,
        offset,
        limit,
        facets: {
          weeks,
          shops: Array.from(new Set(w.items.map((item) => item.shopName).filter(Boolean) as string[])),
          warehouses: warehouses.map((warehouse) => ({ code: warehouse.code ?? `未映射:${warehouse.name}`, name: warehouse.name })),
          p1: Array.from(new Set(w.items.map((item) => item.p1).filter(Boolean) as string[])),
          p2: Array.from(new Set(w.items.filter((item) => !filters.p1 || item.p1 === filters.p1).map((item) => item.p2).filter(Boolean) as string[])),
          p3: Array.from(new Set(w.items.filter((item) => (!filters.p1 || item.p1 === filters.p1) && (!filters.p2 || item.p2 === filters.p2)).map((item) => item.p3).filter(Boolean) as string[])),
        },
        audit: {
          total: rows.length,
          included: rows.filter((item) => item.classificationStatus === "included").length,
          excluded: rows.filter((item) => item.classificationStatus === "excluded").length,
          unclassified: rows.filter((item) => item.classificationStatus === "unclassified").length,
        },
      }
      return respond(w, data)
    },

    async issue(id) {
      await guard()
      const w = getWorld()
      requirePublished(w)
      const item = w.items.find((candidate) => candidate.ticketItemId === id)
      if (!item) throw new ApiError("NOT_FOUND", `没有找到问题行 ${id}`, 404, undefined, requestId())
      const run = w.runs.find((candidate) => candidate.runId === item.sourceRunId) ?? w.runs[0]
      const contentHash = `sha256:${rnd(item.businessKey, "hash").toString(16).slice(2, 14)}${rnd(item.businessKey, "hash2").toString(16).slice(2, 14)}`
      const missingFields: IssueDetail["missingFields"] = []
      if (item.afterSalesAmount === null) missingFields.push({ field: "after_sales_amount", reason: item.sourceSystem === "banniu" ? "班牛历史接口未提供金额字段" : "来源记录中为空" })
      if (item.refundAmount === null) missingFields.push({ field: "refund_amount", reason: item.sourceSystem === "banniu" ? "班牛历史接口未提供退款字段" : "该问题未发生退款" })
      if (!item.merchantCode) missingFields.push({ field: "merchant_code", reason: "来源商品行没有商家编码，等待人工匹配" })
      if (!item.warehouseCode) missingFields.push({ field: "warehouse_code", reason: item.warehouseName ? "仓库名称存在但未完成编码映射" : "来源记录未包含仓库信息" })
      if (!item.trackingNo) missingFields.push({ field: "tracking_no", reason: "来源记录中为空" })
      const rawSummary: IssueDetail["rawSummary"] = item.sourceSystem === "banniu"
        ? [
            { field: "task_id", value: item.sourceTicketId },
            { field: "sub_goods_key", value: item.ticketItemId.split("#")[1] },
            { field: "shop", value: item.shopName },
            { field: "problem_l1/l2/l3", value: [item.p1, item.p2, item.p3].filter(Boolean).join(" / ") },
            { field: "goods_title", value: item.productTitle },
            { field: "order_no", value: item.orderId ? `${item.orderId.slice(0, 6)}****${item.orderId.slice(-4)}` : null },
            { field: "buyer_nick", value: "（已脱敏）" },
            { field: "warehouse_text", value: item.warehouseName },
          ]
        : [
            { field: "ticket_id", value: item.sourceTicketId },
            { field: "item_index", value: item.ticketItemId.split("#")[1] },
            { field: "shop_name", value: item.shopName },
            { field: "status", value: item.status },
            { field: "issue_path", value: [item.p1, item.p2, item.p3].filter(Boolean).join(" / ") },
            { field: "sku_code", value: item.merchantCode },
            { field: "product_id", value: item.productId },
            { field: "order_id", value: item.orderId ? `${item.orderId.slice(0, 6)}****${item.orderId.slice(-4)}` : null },
            { field: "receiver_mobile", value: "（已脱敏）" },
            { field: "warehouse_code", value: item.warehouseCode },
          ]
      const detail: IssueDetail = {
        ...item,
        evidence: item.evidenceId
          ? {
              evidenceId: item.evidenceId,
              rawRecordId: `raw-${item.sourceSystem}-${item.sourceTicketId.toLowerCase()}`,
              contentHash,
              observedAt: run.finishedAt ?? run.startedAt,
              requestWindowStart: run.windowStart,
              requestWindowEnd: run.windowEnd,
              pageNo: run.pages.length ? 1 + Math.floor(rnd(item.businessKey, "page") * run.pages.length) : null,
              pageCursor: item.sourceSystem === "ticket_service" ? `cursor_${rnd(item.businessKey, "cursor").toString(36).slice(2, 10)}` : null,
            }
          : null,
        syncRun: { runId: run.runId, task: run.task, status: run.status, startedAt: run.startedAt, finishedAt: run.finishedAt, windowStart: run.windowStart, windowEnd: run.windowEnd },
        rawSummary,
        rawPayload: context.identity.role === "admin"
          ? JSON.stringify(Object.fromEntries(rawSummary.map((entry) => [entry.field, entry.value])), null, 2)
          : null,
        missingFields,
      }
      return respond(w, detail)
    },

    async productsWeekly(params = {}) {
      await guard()
      const w = world()
      requirePublished(w)
      const selectable = w.trendWeeks
      const selected = selectable.find((week) => week.start === params.week) ?? selectable[selectable.length - 1]
      const selectedIndex = selectable.findIndex((week) => week.start === selected.start)
      const previous = selectedIndex === 0 ? w.closedWeeks[0] : selectable[selectedIndex - 1]
      const cur = weekItems(w, selected).filter((item) => item.includedInOperating)
      const prev = weekItems(w, previous).filter((item) => item.includedInOperating)
      const rows = products
        .filter((product) => product.merchantCode)
        .map((product) => {
          const nowRows = cur.filter((item) => item.merchantCode === product.merchantCode)
          const prevRows = prev.filter((item) => item.merchantCode === product.merchantCode)
          return {
            merchantCode: product.merchantCode!,
            productTitle: product.title,
            productIdCount: new Set(nowRows.map((item) => item.productId).filter(Boolean)).size,
            currentIssues: nowRows.length,
            previousIssues: prevRows.length,
            delta: nowRows.length - prevRows.length,
            sources: Array.from(new Set(nowRows.map((item) => item.sourceSystem))),
          }
        })
        .filter((row) => row.currentIssues > 0 || row.previousIssues > 0)
        .sort((a, b) => b.currentIssues - a.currentIssues || b.delta - a.delta)
      const unmatched = cur.filter((item) => !item.merchantCode).length
      const isLatest = selectedIndex === selectable.length - 1
      const data: ProductWeeklyData = {
        selectedWeek: selected,
        previousWeek: previous,
        selectableWeeks: selectable,
        rows,
        matchedIssues: cur.length - unmatched,
        unmatchedIssues: unmatched,
        totalOperatingIssues: cur.length,
        sourceBreakdown: (["banniu", "ticket_service"] as SourceSystem[]).map((sourceSystem) => ({ sourceSystem, issues: cur.filter((item) => item.sourceSystem === sourceSystem).length })).filter((entry) => entry.issues > 0),
        backfill: isLatest
          ? { status: "complete", note: "上一完整周补数已通过质量检查并发布" }
          : selected.start === w.cutoverWeek.start
            ? { status: "pending", note: "交界周需等待班牛与新工单对账确认，当前为两侧去重前的合并结果" }
            : { status: "complete", note: "历史周补数已发布" },
      }
      return respond(w, data)
    },

    async warehouses(params = {}) {
      await guard()
      const w = world()
      requirePublished(w)
      const selected = w.trendWeeks.find((week) => week.start === params.week) ?? w.trendWeeks[w.trendWeeks.length - 1]
      const index = w.trendWeeks.findIndex((week) => week.start === selected.start)
      const previous = index === 0 ? w.closedWeeks[0] : w.trendWeeks[index - 1]
      const cur = weekItems(w, selected).filter((item) => item.category === "库房问题" && item.includedInOperating)
      const prev = weekItems(w, previous).filter((item) => item.category === "库房问题" && item.includedInOperating)
      const storeOrders = ordersFor(w, selected)
      const prevStoreOrders = ordersFor(w, previous)
      const rows = warehouses.map((warehouse) => {
        const match = (item: IssueListItem) => (warehouse.code ? item.warehouseCode === warehouse.code : item.warehouseName === warehouse.name)
        const nowIssues = cur.filter(match).length
        const prevIssues = prev.filter(match).length
        const orders: Metric = warehouse.weeklyOrders === null
          ? { value: null, status: "unavailable", reason: "仓库未完成映射，不使用全店订单兜底" }
          : storeOrders.value === null ? storeOrders : ready(warehouse.weeklyOrders)
        const prevOrders: Metric = warehouse.weeklyOrders === null ? orders : prevStoreOrders.value === null ? prevStoreOrders : ready(warehouse.weeklyOrders)
        const rate = rateOf(nowIssues, orders)
        const previousRate = rateOf(prevIssues, prevOrders)
        return {
          warehouseCode: warehouse.code ?? `未映射:${warehouse.name}`,
          warehouseName: warehouse.name,
          sourceSystem: warehouse.sourceSystem,
          matchStatus: warehouse.matchStatus,
          confidence: warehouse.confidence,
          currentIssues: nowIssues,
          previousIssues: prevIssues,
          orders,
          rate,
          previousRate,
          deltaPp: rate.value !== null && previousRate.value !== null ? Math.round((rate.value - previousRate.value) * 100) / 100 : null,
        }
      }).sort((a, b) => b.currentIssues - a.currentIssues)
      const data: WarehouseData = {
        week: selected,
        previousWeek: previous,
        rows,
        pendingMappings: warehouses.filter((warehouse) => warehouse.matchStatus === "pending").length,
        totalWarehouseIssues: cur.length,
      }
      return respond(w, data)
    },

    async rules() {
      await guard()
      const w = getWorld()
      if (!ruleState.rules) {
        ruleState.rules = {
          categories: categories.map((category) => ({ category, description: `${category}路径下的售后问题`, enabled: true, updatedBy: "系统初始化", updatedAt: "2026-08-25T09:00:00+08:00" })),
          exclusionRules: w.rules,
          ruleVersion: w.publishedDataset.ruleVersion,
          publishedRuleVersion: w.publishedDataset.ruleVersion,
          requiresRepublish: false,
          lastChange: { by: "陈晓", at: "2026-09-15T14:20:00+08:00", summary: "确认“顾客退款”和“需派件上门”剔除口径" },
        }
      }
      return respond(w, ruleState.rules)
    },

    async updateRule(ruleId, input) {
      await guard()
      if (context.identity.role !== "admin") throw new ApiError("FORBIDDEN", "只有管理员可以修改规则", 403, { requiredRole: "admin", currentRole: context.identity.role }, requestId())
      const current = (await this.rules()).data
      const rule = current.exclusionRules.find((candidate) => candidate.ruleId === ruleId)
      if (!rule) throw new ApiError("NOT_FOUND", `规则 ${ruleId} 不存在`, 404, undefined, requestId())
      const now = new Date().toISOString()
      const nextVersionNumber = Number(current.ruleVersion.replace("rules-v", "")) + 1
      const updated: RulesData = {
        ...current,
        exclusionRules: current.exclusionRules.map((candidate) => candidate.ruleId === ruleId
          ? { ...candidate, enabled: input.enabled ?? candidate.enabled, note: input.note ?? candidate.note, updatedBy: context.identity.displayName, updatedAt: now }
          : candidate),
        ruleVersion: `rules-v${nextVersionNumber}`,
        requiresRepublish: true,
        lastChange: { by: context.identity.displayName, at: now, summary: `${rule.p1} / ${rule.p2} / ${rule.p3}：${input.enabled === undefined ? "更新说明" : input.enabled ? "启用剔除" : "停用剔除"}` },
      }
      ruleState.rules = updated
      return respond(getWorld(), updated, "规则版本已变更，业务数据集需要重新计算并发布后才会反映到页面")
    },

    async dataStatus() {
      await guard()
      const w = world()
      const publishedAt = w.publishedDataset.publishedAt
      const lagHours = publishedAt ? differenceInHours(w.now, new Date(publishedAt)) : null
      const dataset: DatasetSummary = scenario === "unpublished"
        ? { ...w.publishedDataset, state: "pending_checks", publishedAt: null, requiredChecksPassed: false }
        : w.publishedDataset
      const data: DataStatusData = {
        dataset,
        latestAttempt: scenario === "unpublished"
          ? { version: w.latestAttempt.version, state: "pending_checks", attemptedAt: w.latestAttempt.attemptedAt, failedChecks: [] }
          : w.latestAttempt,
        sources: w.sources,
        checks: scenario === "unpublished" ? w.checks.map((check) => ({ ...check, status: check.required ? "skipped" : check.status, summary: "等待数据集发布后执行" })) : w.checks,
        lag: {
          hours: lagHours,
          reason: scenario === "stale"
            ? "外部数据库只读连接连续失败，订单水位未推进，发布任务被质量门槛阻断"
            : scenario === "partial"
              ? "光电通订单表最近 3 天尚未产出，订单分母缺失"
              : scenario === "unpublished"
                ? "首个数据集尚未通过必需质量检查"
                : null,
        },
        scheduleDeadline: { label: "周一 15:00（Asia/Shanghai）前形成可读数据集", met: scenario === "stale" ? false : scenario === "unpublished" ? null : true },
      }
      return respond(w, data, scenario === "unpublished" ? "等待数据发布" : undefined)
    },

    async syncRuns(filters: SyncRunFilters) {
      await guard()
      const w = world()
      let rows: SyncRunSummary[] = w.runs
      if (filters.source && filters.source !== "all") rows = rows.filter((run) => run.sourceSystem === filters.source)
      if (filters.status && filters.status !== "all") rows = rows.filter((run) => run.status === filters.status)
      const limit = Math.min(50, Math.max(5, filters.limit ?? 20))
      const offset = Math.max(0, filters.offset ?? 0)
      const data: ListData<SyncRunSummary> = {
        items: rows.slice(offset, offset + limit).map(({ runId, task, sourceSystem, trigger, windowStart, windowEnd, status, startedAt, finishedAt, durationMs, readRows, writtenRows, updatedRows, skippedRows, errorCode, errorSummary, datasetVersion }) => ({ runId, task, sourceSystem, trigger, windowStart, windowEnd, status, startedAt, finishedAt, durationMs, readRows, writtenRows, updatedRows, skippedRows, errorCode, errorSummary, datasetVersion })),
        total: rows.length,
        offset,
        limit,
      }
      return respond(w, data)
    },

    async syncRun(runId) {
      await guard()
      const w = getWorld()
      const run: SyncRunDetail | undefined = w.runs.find((candidate) => candidate.runId === runId)
      if (!run) throw new ApiError("NOT_FOUND", `没有找到运行 ${runId}`, 404, undefined, requestId())
      return respond(w, run)
    },

    exportUrl() {
      return null
    },
  }
}
