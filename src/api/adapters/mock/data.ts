import { addDays, differenceInCalendarDays, format, parseISO, startOfWeek, subHours, subMinutes } from "date-fns"

import { closedWeekWindows, shanghaiToday } from "@/src/modules/analytics/date-windows"
import type {
  ClassificationStatus,
  DatasetSummary,
  ExclusionRule,
  IssueListItem,
  ProblemCategory,
  QualityCheck,
  SourceStatus,
  SourceSystem,
  SyncRunDetail,
  WarehouseMatchStatus,
  WeekWindow,
} from "../../contracts"

/* ------------------------------------------------------------------ */
/* 受控样例词表：字段结构与真实业务一致，数值由确定性函数生成，可复现。 */
/* ------------------------------------------------------------------ */

export const categories: ProblemCategory[] = ["快递问题", "库房问题", "买家问题", "产品问题", "运营问题"]

export const shops = ["榆园食品旗舰店（抖音）", "榆园官方旗舰店（天猫）", "榆园自营店（拼多多）", "榆园严选（京东）"]

export interface ProductSpec {
  merchantCode: string | null
  title: string
  productIds: string[]
  weeklyOrders: number
  /** 0-1，越大售后越多。 */
  weight: number
}

export const products: ProductSpec[] = [
  { merchantCode: "YY-0107", title: "东北黑蜂椴树蜜 500g", productIds: ["3641097265110001", "3641097265110002"], weeklyOrders: 1860, weight: 1.35 },
  { merchantCode: "YY-0112", title: "东北黑蜂椴树蜜 250g×2", productIds: ["3641097265110115"], weeklyOrders: 1240, weight: 0.9 },
  { merchantCode: "YY-0203", title: "云南高山核桃 1kg", productIds: ["3641097265120031", "3641097265120032"], weeklyOrders: 980, weight: 1.1 },
  { merchantCode: "YY-0311", title: "即食燕窝礼盒 6 瓶", productIds: ["3641097265130118"], weeklyOrders: 420, weight: 1.6 },
  { merchantCode: "YY-0408", title: "长白山人参片 100g", productIds: ["3641097265140084"], weeklyOrders: 610, weight: 0.7 },
  { merchantCode: "YY-0512", title: "有机杂粮组合 8 袋", productIds: ["3641097265150122", "3641097265150123", "3641097265150124"], weeklyOrders: 1530, weight: 1.0 },
  { merchantCode: "YY-0617", title: "冻干草莓脆 60g×3", productIds: ["3641097265160175"], weeklyOrders: 2210, weight: 1.25 },
  { merchantCode: "YY-0705", title: "手工牛肉干 200g", productIds: ["3641097265170052"], weeklyOrders: 1170, weight: 0.85 },
  { merchantCode: "YY-0809", title: "黑芝麻丸 300g", productIds: ["3641097265180093"], weeklyOrders: 890, weight: 0.65 },
  { merchantCode: "YY-0902", title: "榆园蜂蜜柚子茶 480g", productIds: ["3641097265190024"], weeklyOrders: 1410, weight: 1.15 },
  { merchantCode: "YY-1004", title: "松茸菌汤包 120g", productIds: ["3641097265200041"], weeklyOrders: 530, weight: 0.5 },
  { merchantCode: "YY-1106", title: "桂花红糖姜茶 12 条", productIds: ["3641097265210066"], weeklyOrders: 760, weight: 0.6 },
  { merchantCode: null, title: "试吃装（随单赠品）", productIds: [], weeklyOrders: 0, weight: 0.3 },
]

interface ProblemPath {
  p1: string
  p2: string
  p3: string
  category: ProblemCategory | null
  status: ClassificationStatus
  weight: number
  refund: boolean
  warehouseRelated: boolean
}

export const problemPaths: ProblemPath[] = [
  { p1: "快递问题", p2: "物流延迟", p3: "需催件", category: "快递问题", status: "excluded", weight: 1.4, refund: false, warehouseRelated: false },
  { p1: "快递问题", p2: "物流延迟", p3: "超 7 天未更新", category: "快递问题", status: "included", weight: 1.0, refund: false, warehouseRelated: false },
  { p1: "快递问题", p2: "运输破损", p3: "外包装破损", category: "快递问题", status: "included", weight: 1.2, refund: true, warehouseRelated: false },
  { p1: "快递问题", p2: "运输破损", p3: "产品渗漏", category: "快递问题", status: "included", weight: 0.7, refund: true, warehouseRelated: false },
  { p1: "快递问题", p2: "顾客退款", p3: "拒收", category: "快递问题", status: "excluded", weight: 0.8, refund: true, warehouseRelated: false },
  { p1: "快递问题", p2: "改地址", p3: "发货前改地址", category: "快递问题", status: "excluded", weight: 0.9, refund: false, warehouseRelated: false },
  { p1: "快递问题", p2: "签收未收到", p3: "需派件上门", category: "快递问题", status: "excluded", weight: 0.5, refund: false, warehouseRelated: false },
  { p1: "快递问题", p2: "签收未收到", p3: "快递丢件", category: "快递问题", status: "included", weight: 0.4, refund: true, warehouseRelated: false },
  { p1: "库房问题", p2: "发货错误", p3: "发错规格", category: "库房问题", status: "included", weight: 0.9, refund: false, warehouseRelated: true },
  { p1: "库房问题", p2: "发货错误", p3: "漏发赠品", category: "库房问题", status: "included", weight: 1.1, refund: false, warehouseRelated: true },
  { p1: "库房问题", p2: "包装压损", p3: "内箱压损", category: "库房问题", status: "included", weight: 0.7, refund: true, warehouseRelated: true },
  { p1: "库房问题", p2: "配件缺失", p3: "缺少勺子", category: "库房问题", status: "included", weight: 0.6, refund: false, warehouseRelated: true },
  { p1: "库房问题", p2: "临期", p3: "距保质期不足 30 天", category: "库房问题", status: "included", weight: 0.35, refund: true, warehouseRelated: true },
  { p1: "买家问题", p2: "无理由退", p3: "7 天无理由", category: "买家问题", status: "excluded", weight: 1.3, refund: true, warehouseRelated: false },
  { p1: "买家问题", p2: "拍错", p3: "拍错规格", category: "买家问题", status: "included", weight: 0.6, refund: true, warehouseRelated: false },
  { p1: "买家问题", p2: "描述不符", p3: "与预期口味不同", category: "买家问题", status: "included", weight: 0.7, refund: true, warehouseRelated: false },
  { p1: "产品问题", p2: "外观瑕疵", p3: "结晶发白", category: "产品问题", status: "included", weight: 0.9, refund: false, warehouseRelated: false },
  { p1: "产品问题", p2: "功能异常", p3: "开盖困难", category: "产品问题", status: "included", weight: 0.5, refund: false, warehouseRelated: false },
  { p1: "产品问题", p2: "口感异常", p3: "发酸", category: "产品问题", status: "included", weight: 0.6, refund: true, warehouseRelated: false },
  { p1: "产品问题", p2: "异物", p3: "疑似异物", category: "产品问题", status: "included", weight: 0.25, refund: true, warehouseRelated: false },
  { p1: "运营问题", p2: "描述不符", p3: "页面重量标注错误", category: "运营问题", status: "included", weight: 0.5, refund: true, warehouseRelated: false },
  { p1: "运营问题", p2: "优惠未生效", p3: "优惠券未抵扣", category: "运营问题", status: "included", weight: 0.6, refund: false, warehouseRelated: false },
  { p1: "运营问题", p2: "发货超时", p3: "48 小时未发货", category: "运营问题", status: "included", weight: 0.7, refund: false, warehouseRelated: true },
  { p1: "其他", p2: "要求理赔", p3: "", category: null, status: "unclassified", weight: 0.35, refund: false, warehouseRelated: false },
  { p1: "售后咨询", p2: "", p3: "", category: null, status: "unclassified", weight: 0.25, refund: false, warehouseRelated: false },
]

export interface WarehouseSpec {
  code: string | null
  name: string | null
  sourceSystem: SourceSystem
  matchStatus: WarehouseMatchStatus
  confidence: number | null
  weeklyOrders: number | null
  weight: number
}

export const warehouses: WarehouseSpec[] = [
  { code: "WH-SY01", name: "沈阳一仓", sourceSystem: "external_db", matchStatus: "confirmed", confidence: 1, weeklyOrders: 4320, weight: 1.2 },
  { code: "WH-BJ02", name: "北京二仓", sourceSystem: "external_db", matchStatus: "confirmed", confidence: 1, weeklyOrders: 3180, weight: 0.9 },
  { code: "WH-HZ01", name: "杭州仓", sourceSystem: "external_db", matchStatus: "auto", confidence: 0.86, weeklyOrders: 2760, weight: 1.0 },
  { code: "WH-CD01", name: "成都仓", sourceSystem: "external_db", matchStatus: "confirmed", confidence: 1, weeklyOrders: 1540, weight: 0.6 },
  { code: "WH-GZ03", name: "广州三仓", sourceSystem: "ticket_service", matchStatus: "auto", confidence: 0.72, weeklyOrders: 1810, weight: 0.8 },
  { code: null, name: "菏泽云仓", sourceSystem: "banniu", matchStatus: "pending", confidence: null, weeklyOrders: null, weight: 0.5 },
]

const carriers = ["中通快递", "圆通速递", "顺丰速运", "京东物流", "极兔速递"]

/* ------------------------------------------------------------------ */
/* 确定性伪随机：同一输入永远得到同一输出，保证演示可复现。            */
/* ------------------------------------------------------------------ */

export function rnd(...parts: Array<string | number>): number {
  let hash = 2166136261
  for (const part of parts.join("|")) {
    hash ^= part.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return ((hash >>> 0) % 100000) / 100000
}

function pickWeighted<T extends { weight: number }>(items: T[], roll: number): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0)
  let cursor = roll * total
  for (const item of items) {
    cursor -= item.weight
    if (cursor <= 0) return item
  }
  return items[items.length - 1]
}

export function shanghaiIso(date: Date, hour: number, minute: number) {
  return `${format(date, "yyyy-MM-dd")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+08:00`
}

function instantIso(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).format(date).replace(" ", "T") + "+08:00"
}

/* ------------------------------------------------------------------ */
/* 世界构建                                                            */
/* ------------------------------------------------------------------ */

export interface MockWorld {
  now: Date
  today: Date
  closedWeeks: WeekWindow[]
  trendWeeks: WeekWindow[]
  currentWeek: WeekWindow & { completedDays: number }
  cutoverAt: string
  cutoverWeek: WeekWindow
  items: IssueListItem[]
  storeOrdersByWeek: Map<string, number>
  storeSalesByWeek: Map<string, number>
  orderThrough: string
  runs: SyncRunDetail[]
  publishedDataset: DatasetSummary
  latestAttempt: { version: string; state: DatasetSummary["state"]; attemptedAt: string; failedChecks: string[] }
  checks: QualityCheck[]
  sources: SourceStatus[]
  rules: ExclusionRule[]
}

const weeklyVolume = [63, 58, 66, 71, 74]

let cached: { key: string; world: MockWorld } | null = null

export function getWorld(now = new Date()): MockWorld {
  const today = shanghaiToday(now)
  const key = format(today, "yyyy-MM-dd")
  if (cached?.key === key) return { ...cached.world, now }

  const closedWeeks = closedWeekWindows(today, 6)
  const trendWeeks = closedWeeks.slice(1)
  const currentStart = startOfWeek(today, { weekStartsOn: 0 })
  const currentWeek = {
    start: format(currentStart, "yyyy-MM-dd"),
    end: format(today, "yyyy-MM-dd"),
    label: `本周进度 ${format(currentStart, "MMdd")}-${format(addDays(today, -1), "MMdd")}`,
    completedDays: Math.max(0, differenceInCalendarDays(today, currentStart)),
  }
  const cutoverWeek = trendWeeks[1]
  const cutoverAt = shanghaiIso(addDays(parseISO(cutoverWeek.start), 2), 0, 0)
  const orderThrough = format(addDays(today, -1), "yyyy-MM-dd")

  const items: IssueListItem[] = []
  const weeksForItems: Array<{ week: WeekWindow; volume: number }> = [
    ...closedWeeks.map((week, index) => ({ week, volume: index === 0 ? 60 : weeklyVolume[index - 1] })),
    { week: currentWeek, volume: Math.round((74 / 7) * Math.max(1, currentWeek.completedDays + 1)) },
  ]

  for (const { week, volume } of weeksForItems) {
    const weekStart = parseISO(week.start)
    const spanDays = Math.max(1, differenceInCalendarDays(parseISO(week.end), weekStart))
    for (let index = 0; index < volume; index += 1) {
      const seed = `${week.start}-${index}`
      const dayOffset = Math.min(spanDays - 1, Math.floor(rnd(seed, "day") * spanDays))
      const created = addDays(weekStart, dayOffset)
      const hour = 8 + Math.floor(rnd(seed, "hour") * 14)
      const minute = Math.floor(rnd(seed, "minute") * 60)
      const createdAt = shanghaiIso(created, hour, minute)
      const source: SourceSystem = createdAt < cutoverAt ? "banniu" : "ticket_service"
      const product = pickWeighted(products, rnd(seed, "product"))
      const path = pickWeighted(problemPaths, rnd(seed, "path"))
      const warehouse = path.warehouseRelated || rnd(seed, "wh") < 0.55 ? pickWeighted(warehouses, rnd(seed, "which-wh")) : null
      const shop = shops[Math.floor(rnd(seed, "shop") * shops.length)]
      const sourceTicketId = source === "banniu"
        ? `BN${format(created, "yyMMdd")}${String(1000 + Math.floor(rnd(seed, "tid") * 8999))}`
        : `TS-${format(created, "yyyyMMdd")}-${String(100 + Math.floor(rnd(seed, "tid") * 899))}`
      const productId = product.productIds.length ? product.productIds[Math.floor(rnd(seed, "pid") * product.productIds.length)] : null
      const orderId = `${format(created, "yyMMdd")}${String(Math.floor(rnd(seed, "oid") * 1e9)).padStart(9, "0")}`
      const itemNo = 1 + (rnd(seed, "item") < 0.12 ? 1 : 0)
      const ticketItemId = `${sourceTicketId}#${itemNo}`
      const runId = source === "banniu"
        ? (week.start < trendWeeks[0].start ? "run-bn-hist-w0" : `run-bn-hist-${week.start}`)
        : (week.start === currentWeek.start ? "run-ts-inc-today" : `run-ts-inc-${week.start}`)
      const evidenceMissing = source === "banniu" && rnd(seed, "evidence") < 0.04
      const amount = source === "ticket_service" ? Math.round((39 + rnd(seed, "amt") * 260) * 100) / 100 : null
      const refund = path.refund && source === "ticket_service" && amount !== null ? Math.round(amount * (0.3 + rnd(seed, "ref") * 0.7) * 100) / 100 : null
      const isCutoverSuspect = week.start === cutoverWeek.start && rnd(seed, "dup") < 0.06

      items.push({
        ticketItemId,
        ticketId: sourceTicketId,
        sourceSystem: source,
        sourceTicketId,
        businessKey: `${source}:${sourceTicketId}:${itemNo}`,
        shopName: shop,
        status: source === "ticket_service" ? (rnd(seed, "st") < 0.7 ? "已完结" : "处理中") : "已归档",
        createdAt,
        updatedAt: shanghaiIso(addDays(created, rnd(seed, "upd") < 0.5 ? 0 : 1), Math.min(23, hour + 2), minute),
        productTitle: product.title,
        merchantCode: product.merchantCode,
        productId,
        skuText: product.merchantCode ? `${product.title.split(" ").at(-1)} / 默认` : null,
        orderId,
        subOrderId: `${orderId}-${itemNo}`,
        quantity: 1 + (rnd(seed, "qty") < 0.18 ? 1 : 0),
        p1: path.p1,
        p2: path.p2 || null,
        p3: path.p3 || null,
        category: path.category,
        classificationStatus: path.status,
        includedInOperating: path.status === "included",
        warehouseCode: warehouse?.code ?? null,
        warehouseName: warehouse?.name ?? null,
        warehouseMatchStatus: warehouse ? warehouse.matchStatus : "none",
        trackingNo: rnd(seed, "trk") < 0.9 ? `${["75", "YT", "SF", "JD", "JT"][Math.floor(rnd(seed, "car") * 5)]}${String(Math.floor(rnd(seed, "trkno") * 1e12)).padStart(12, "0")}` : null,
        carrierName: rnd(seed, "trk") < 0.9 ? carriers[Math.floor(rnd(seed, "car") * 5)] : null,
        afterSalesAmount: amount,
        refundAmount: refund,
        paymentAt: shanghaiIso(addDays(created, -2 - Math.floor(rnd(seed, "pay") * 6)), 10 + Math.floor(rnd(seed, "ph") * 10), minute),
        refundRequestedAt: refund !== null ? createdAt : null,
        sourceRunId: runId,
        evidenceId: evidenceMissing ? null : `ev-${sourceTicketId.toLowerCase()}-${itemNo}`,
        evidenceStatus: evidenceMissing ? "missing" : source === "banniu" && rnd(seed, "evp") < 0.08 ? "pending" : "verified",
        crossSourceSuspect: isCutoverSuspect,
      })
    }
  }
  items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))

  const storeOrdersByWeek = new Map<string, number>()
  const storeSalesByWeek = new Map<string, number>()
  const baseOrders = products.reduce((sum, product) => sum + product.weeklyOrders, 0)
  for (const [index, week] of closedWeeks.entries()) {
    const orders = Math.round(baseOrders * (0.94 + index * 0.018))
    storeOrdersByWeek.set(week.start, orders)
    storeSalesByWeek.set(week.start, Math.round(orders * 1.17))
  }
  const progressOrders = Math.round((baseOrders / 7) * currentWeek.completedDays * 1.02)
  storeOrdersByWeek.set(currentWeek.start, progressOrders)
  storeSalesByWeek.set(currentWeek.start, Math.round(progressOrders * 1.17))

  const publishedAt = instantIso(subMinutes(subHours(now, 3), 50))
  const publishedVersion = `ds-${format(today, "yyyyMMdd")}-01`
  const publishedDataset: DatasetSummary = {
    version: publishedVersion,
    state: "published",
    publishedAt,
    coverageStart: closedWeeks[0].start,
    coverageEnd: orderThrough,
    sourceBreakdown: [
      { sourceSystem: "banniu", rows: items.filter((item) => item.sourceSystem === "banniu").length },
      { sourceSystem: "ticket_service", rows: items.filter((item) => item.sourceSystem === "ticket_service").length },
      { sourceSystem: "external_db", rows: 18_420 },
    ],
    requiredChecksPassed: true,
    ruleVersion: "rules-v7",
    cutoverAt,
    cutoverConfirmed: false,
  }

  const runs = buildRuns(now, today, closedWeeks, trendWeeks, currentWeek, cutoverWeek, items, publishedVersion, publishedAt)
  const checks = buildChecks(now, publishedVersion, items, orderThrough, cutoverWeek, cutoverAt)
  const sources = buildSources(now, closedWeeks, orderThrough, items)

  const world: MockWorld = {
    now,
    today,
    closedWeeks,
    trendWeeks,
    currentWeek,
    cutoverAt,
    cutoverWeek,
    items,
    storeOrdersByWeek,
    storeSalesByWeek,
    orderThrough,
    runs,
    publishedDataset,
    latestAttempt: {
      version: `ds-${format(today, "yyyyMMdd")}-02`,
      state: "failed",
      attemptedAt: instantIso(subMinutes(subHours(now, 1), 5)),
      failedChecks: ["分页完整性（新工单第 4 页超时，结果未知）"],
    },
    checks,
    sources,
    rules: defaultRules(),
  }
  cached = { key, world }
  return world
}

function defaultRules(): ExclusionRule[] {
  return [
    { ruleId: "rule-001", p1: "快递问题", p2: "顾客退款", p3: "*", note: "顾客退款不进入经营异常统计", enabled: true, updatedBy: "陈晓", updatedAt: "2026-09-15T14:20:00+08:00" },
    { ruleId: "rule-002", p1: "快递问题", p2: "签收未收到", p3: "需派件上门", note: "仅该三级路径可剔除", enabled: true, updatedBy: "陈晓", updatedAt: "2026-09-15T14:20:00+08:00" },
    { ruleId: "rule-003", p1: "快递问题", p2: "改地址", p3: "*", note: "改地址不进入经营异常统计", enabled: true, updatedBy: "系统初始化", updatedAt: "2026-08-25T09:00:00+08:00" },
    { ruleId: "rule-004", p1: "快递问题", p2: "物流延迟", p3: "需催件", note: "仅催件路径可剔除", enabled: true, updatedBy: "系统初始化", updatedAt: "2026-08-25T09:00:00+08:00" },
    { ruleId: "rule-005", p1: "快递问题", p2: "需派件上门", p3: "*", note: "需派件上门不进入经营异常统计", enabled: true, updatedBy: "系统初始化", updatedAt: "2026-08-25T09:00:00+08:00" },
    { ruleId: "rule-006", p1: "买家问题", p2: "无理由退", p3: "*", note: "无理由退不进入经营异常统计", enabled: true, updatedBy: "王磊", updatedAt: "2026-09-10T11:05:00+08:00" },
  ]
}

function buildSources(now: Date, closedWeeks: WeekWindow[], orderThrough: string, items: IssueListItem[]): SourceStatus[] {
  const sixAm = instantIso(subHours(now, 4))
  const fiveAm = instantIso(subHours(now, 5))
  return [
    {
      sourceSystem: "external_db",
      label: "公司服务器外部数据库",
      role: "订单、商品、仓库等辅助事实（光电通及其他来源）",
      lastRunAt: fiveAm,
      lastSuccessAt: fiveAm,
      coverageStart: closedWeeks[0].start,
      coverageEnd: orderThrough,
      readRows: 18_420,
      writtenRows: 18_420,
      status: "succeeded",
      cadence: "daily",
      lagHours: 5,
      note: "只读连接，读取上一完整日订单水位",
    },
    {
      sourceSystem: "banniu",
      label: "班牛 API（旧体系）",
      role: "历史售后记录，交界前为唯一售后来源",
      lastRunAt: sixAm,
      lastSuccessAt: sixAm,
      coverageStart: closedWeeks[0].start,
      coverageEnd: closedWeeks[2].end,
      readRows: items.filter((item) => item.sourceSystem === "banniu").length,
      writtenRows: 0,
      status: "succeeded",
      cadence: "daily",
      lagHours: 4,
      note: "增量为 0 行，旧体系已停止新增；历史补数进行中",
    },
    {
      sourceSystem: "ticket_service",
      label: "新工单系统 API（新体系）",
      role: "交接后的售后工单与商品行",
      lastRunAt: instantIso(subMinutes(subHours(now, 1), 20)),
      lastSuccessAt: sixAm,
      coverageStart: closedWeeks[1].start,
      coverageEnd: orderThrough,
      readRows: 214,
      writtenRows: 187,
      status: "unknown",
      cadence: "daily",
      lagHours: 4,
      note: "最近一次增量第 4 页请求超时，结果未知，等待人工核对",
    },
  ]
}

function buildChecks(now: Date, version: string, items: IssueListItem[], orderThrough: string, cutoverWeek: WeekWindow, cutoverAt: string): QualityCheck[] {
  const checkedAt = instantIso(subMinutes(subHours(now, 3), 49))
  const banniuCutover = items.filter((item) => item.createdAt >= cutoverWeek.start && item.createdAt < cutoverWeek.end && item.sourceSystem === "banniu").length
  const ticketCutover = items.filter((item) => item.createdAt >= cutoverWeek.start && item.createdAt < cutoverWeek.end && item.sourceSystem === "ticket_service").length
  const suspects = items.filter((item) => item.crossSourceSuspect).length
  const withCode = items.filter((item) => item.merchantCode).length
  const coverage = ((withCode / items.length) * 100).toFixed(1)
  return [
    { checkId: `${version}-pages`, kind: "page_completeness", label: "分页完整性", status: "passed", required: true, summary: "班牛 12 页、新工单 9 页全部返回且页摘要一致", measured: "21/21 页完整", threshold: "100%", checkedAt, runId: "run-qc-today" },
    { checkId: `${version}-dup`, kind: "duplicate_identity", label: "重复身份", status: "passed", required: true, summary: "同来源业务键无重复写入", measured: "0 条重复", threshold: "0", checkedAt, runId: "run-qc-today" },
    { checkId: `${version}-gone`, kind: "source_disappearance", label: "来源记录消失", status: "warning", required: false, summary: "2 条班牛记录在本次读取中不再返回，已标记待核对，未从业务表删除", measured: "2 条", threshold: "0", checkedAt, runId: "run-qc-today" },
    { checkId: `${version}-cutover`, kind: "cutover_reconciliation", label: "交界对账", status: "warning", required: false, summary: `交界周 ${cutoverWeek.label}：班牛 ${banniuCutover} 条、新工单 ${ticketCutover} 条、疑似跨来源重复 ${suspects} 条，等待人工确认（cutover_at 样例值 ${cutoverAt.slice(0, 16)}）`, measured: `${suspects} 条疑似重复`, threshold: "人工确认", checkedAt, runId: "run-qc-today" },
    { checkId: `${version}-fields`, kind: "field_coverage", label: "字段覆盖", status: "passed", required: true, summary: "商家编码覆盖率达到门槛；金额字段班牛来源缺失属预期", measured: `商家编码 ${coverage}%`, threshold: "≥ 95%", checkedAt, runId: "run-qc-today" },
    { checkId: `${version}-orders`, kind: "order_watermark", label: "订单水位", status: "passed", required: true, summary: `订单事实已覆盖到 ${orderThrough}`, measured: orderThrough, threshold: "≥ 上一完整日", checkedAt, runId: "run-qc-today" },
    { checkId: `${version}-fresh`, kind: "freshness", label: "新鲜度", status: "passed", required: true, summary: "发布时间在周一 15:00 截止前", measured: "3 小时 50 分前", threshold: "≤ 24 小时", checkedAt, runId: "run-qc-today" },
  ]
}

function buildRuns(
  now: Date,
  today: Date,
  closedWeeks: WeekWindow[],
  trendWeeks: WeekWindow[],
  currentWeek: WeekWindow,
  cutoverWeek: WeekWindow,
  items: IssueListItem[],
  publishedVersion: string,
  publishedAt: string,
): SyncRunDetail[] {
  const at = (hoursAgo: number, minutesAgo = 0) => instantIso(subMinutes(subHours(now, hoursAgo), minutesAgo))
  const yesterday = format(addDays(today, -1), "yyyy-MM-dd")
  const todayIso = format(today, "yyyy-MM-dd")
  const sample = (runId: string, count: number) => items.filter((item) => item.sourceRunId === runId).slice(0, count).map((item) => ({ evidenceId: item.evidenceId ?? "（缺失）", sourceTicketId: item.sourceTicketId, ticketItemId: item.ticketItemId }))

  const base = (partial: Omit<SyncRunDetail, "pages" | "affectedTickets" | "affectedWeeks" | "retrySafe" | "recoveryAdvice" | "logs" | "evidenceSamples" | "dryRun"> & Partial<SyncRunDetail>): SyncRunDetail => ({
    pages: [],
    affectedTickets: null,
    affectedWeeks: [],
    retrySafe: null,
    recoveryAdvice: "无需处理",
    logs: [],
    evidenceSamples: [],
    dryRun: null,
    ...partial,
  })

  const pages = (count: number, readPerPage: number, brokenPage?: number, brokenKind?: "timeout" | "digest") =>
    Array.from({ length: count }, (_, index) => {
      const pageNo = index + 1
      const broken = pageNo === brokenPage
      return {
        pageNo,
        requestDigest: `req:${rnd("req", pageNo, count).toString(16).slice(2, 10)}`,
        responseDigest: broken && brokenKind === "timeout" ? "（无响应）" : `res:${rnd("res", pageNo, count).toString(16).slice(2, 10)}`,
        readRows: broken && brokenKind === "timeout" ? 0 : readPerPage,
        duplicateRows: broken && brokenKind === "digest" ? 3 : 0,
        complete: !broken,
      }
    })

  return [
    base({
      runId: "run-pub-attempt-02", task: "业务读模型计算与数据集发布", sourceSystem: null, trigger: "publish",
      windowStart: closedWeeks[0].start, windowEnd: todayIso, status: "failed", startedAt: at(1, 8), finishedAt: at(1, 5), durationMs: 180_000,
      readRows: null, writtenRows: 0, updatedRows: 0, skippedRows: null, errorCode: "QC_REQUIRED_FAILED", errorSummary: "必需检查“分页完整性”未通过：依赖的新工单增量运行 run-ts-inc-0910 结果未知", datasetVersion: `ds-${format(today, "yyyyMMdd")}-02`,
      affectedWeeks: [currentWeek.label], retrySafe: false,
      recoveryAdvice: "先人工核对 run-ts-inc-0910 第 4 页的实际写入结果；确认后重跑该页，再重新发布。页面继续使用上一版数据集。",
      logs: [
        { at: at(1, 8), level: "info", message: "开始计算 business_overview_weekly / business_issue_summary" },
        { at: at(1, 6), level: "error", message: "质量门槛失败：page_completeness required=true status=failed run=run-ts-inc-0910" },
        { at: at(1, 5), level: "warn", message: `保留 ${publishedVersion} 为当前发布版本，未做切换` },
      ],
    }),
    base({
      runId: "run-ts-inc-0910", task: "新工单增量同步", sourceSystem: "ticket_service", trigger: "schedule",
      windowStart: `${yesterday}T06:00:00+08:00`, windowEnd: at(1, 20), status: "unknown", startedAt: at(1, 20), finishedAt: at(1, 12), durationMs: 480_000,
      readRows: 96, writtenRows: 71, updatedRows: 9, skippedRows: null, errorCode: "TS_PAGE_TIMEOUT", errorSummary: "第 4 页请求超时（30s），服务端是否已处理未知", datasetVersion: null,
      pages: pages(5, 32, 4, "timeout"), affectedTickets: 32, affectedWeeks: [currentWeek.label], retrySafe: false,
      recoveryAdvice: "不要盲目重放。先按 来源 + 页码 查询第 4 页的结果摘要，与已写入的业务键比对后再决定重跑该页。",
      logs: [
        { at: at(1, 20), level: "info", message: "窗口 06:00 → 现在，limit=32，预计 5 页" },
        { at: at(1, 14), level: "warn", message: "page=4 request timeout after 30000ms" },
        { at: at(1, 12), level: "error", message: "run status=unknown，不写入数据集，等待人工核对" },
      ],
    }),
    base({
      runId: "run-qc-today", task: "质量检查与运行汇总", sourceSystem: null, trigger: "publish",
      windowStart: closedWeeks[0].start, windowEnd: yesterday, status: "succeeded", startedAt: at(3, 51), finishedAt: at(3, 49), durationMs: 96_000,
      readRows: items.length, writtenRows: 7, updatedRows: 0, skippedRows: 0, errorCode: null, errorSummary: null, datasetVersion: publishedVersion,
      affectedWeeks: trendWeeks.map((week) => week.label),
      logs: [{ at: at(3, 49), level: "info", message: "7 项检查完成：5 通过，2 提示" }],
    }),
    base({
      runId: "run-pub-today", task: "业务读模型计算与数据集发布", sourceSystem: null, trigger: "publish",
      windowStart: closedWeeks[0].start, windowEnd: yesterday, status: "succeeded", startedAt: at(3, 55), finishedAt: publishedAt, durationMs: 300_000,
      readRows: items.length, writtenRows: items.length, updatedRows: 0, skippedRows: 0, errorCode: null, errorSummary: null, datasetVersion: publishedVersion,
      affectedWeeks: [...trendWeeks.map((week) => week.label), currentWeek.label],
      logs: [{ at: publishedAt, level: "info", message: `原子切换 analytics_dataset_versions.current → ${publishedVersion}` }],
    }),
    base({
      runId: "run-ts-inc-today", task: "新工单增量同步", sourceSystem: "ticket_service", trigger: "schedule",
      windowStart: `${yesterday}T00:00:00+08:00`, windowEnd: at(4), status: "succeeded", startedAt: at(4, 2), finishedAt: at(4), durationMs: 132_000,
      readRows: 214, writtenRows: 187, updatedRows: 27, skippedRows: 0, errorCode: null, errorSummary: null, datasetVersion: publishedVersion,
      pages: pages(7, 32), affectedTickets: 187, affectedWeeks: [currentWeek.label], retrySafe: true,
      evidenceSamples: sample("run-ts-inc-today", 5),
      logs: [{ at: at(4), level: "info", message: "7 页完整，双读校验一致" }],
    }),
    base({
      runId: "run-bn-inc-today", task: "班牛增量同步", sourceSystem: "banniu", trigger: "schedule",
      windowStart: `${yesterday}T00:00:00+08:00`, windowEnd: at(4), status: "succeeded", startedAt: at(4, 15), finishedAt: at(4, 14), durationMs: 41_000,
      readRows: 0, writtenRows: 0, updatedRows: 0, skippedRows: 0, errorCode: null, errorSummary: null, datasetVersion: publishedVersion,
      pages: pages(1, 0), affectedTickets: 0, retrySafe: true,
      logs: [{ at: at(4, 14), level: "info", message: "旧体系窗口内无新增记录" }],
    }),
    base({
      runId: "run-ext-today", task: "外部数据库辅助数据同步", sourceSystem: "external_db", trigger: "schedule",
      windowStart: yesterday, windowEnd: yesterday, status: "succeeded", startedAt: at(5, 4), finishedAt: at(5), durationMs: 240_000,
      readRows: 18_420, writtenRows: 18_420, updatedRows: 0, skippedRows: 0, errorCode: null, errorSummary: null, datasetVersion: publishedVersion,
      affectedWeeks: [currentWeek.label], retrySafe: true,
      logs: [{ at: at(5), level: "info", message: "order_facts 水位推进到 " + yesterday }],
    }),
    base({
      runId: "run-bf-preview-current", task: "补数预演（dry-run）", sourceSystem: "ticket_service", trigger: "backfill",
      windowStart: currentWeek.start, windowEnd: todayIso, status: "awaiting_confirmation", startedAt: at(13, 30), finishedAt: at(13, 18), durationMs: 720_000,
      readRows: items.filter((item) => item.createdAt >= currentWeek.start).length, writtenRows: 0, updatedRows: 0, skippedRows: 0, errorCode: null, errorSummary: null, datasetVersion: null,
      affectedWeeks: [currentWeek.label], retrySafe: true,
      recoveryAdvice: "预演结果已记录，未写入业务表。需人工确认后通过 /internal/backfill/apply 应用。",
      dryRun: { added: 51, updated: 6, unchanged: 3, missing: 0, duplicates: 0, crossSourceSuspects: 0, unmatched: 4 },
      logs: [{ at: at(13, 18), level: "info", message: "dry-run 完成：新增 51，更新 6，未变化 3，无法匹配商家编码 4" }],
    }),
    base({
      runId: `run-bn-hist-${trendWeeks[0].start}`, task: "班牛历史补数", sourceSystem: "banniu", trigger: "backfill",
      windowStart: trendWeeks[0].start, windowEnd: trendWeeks[0].end, status: "partial", startedAt: at(31), finishedAt: at(30, 40), durationMs: 1_200_000,
      readRows: 60, writtenRows: 57, updatedRows: 0, skippedRows: 3, errorCode: "BN_PAGE_DIGEST_CHANGED", errorSummary: "第 7 页在双读之间响应摘要发生变化，出现 3 条重复记录，已跳过未写入", datasetVersion: publishedVersion,
      pages: pages(12, 5, 7, "digest"), affectedTickets: 3, affectedWeeks: [trendWeeks[0].label], retrySafe: true,
      recoveryAdvice: "可安全重试：仅重跑 来源=banniu + 页码=7，写入受业务键唯一约束保护。",
      evidenceSamples: sample(`run-bn-hist-${trendWeeks[0].start}`, 4),
      logs: [
        { at: at(30, 44), level: "warn", message: "page=7 digest mismatch between read #1 and read #2" },
        { at: at(30, 40), level: "info", message: "run status=partial，其余 11 页已写入" },
      ],
    }),
    base({
      runId: `run-bn-hist-${cutoverWeek.start}`, task: "班牛历史补数", sourceSystem: "banniu", trigger: "backfill",
      windowStart: cutoverWeek.start, windowEnd: cutoverWeek.end, status: "succeeded", startedAt: at(55), finishedAt: at(54, 30), durationMs: 1_500_000,
      readRows: items.filter((item) => item.sourceRunId === `run-bn-hist-${cutoverWeek.start}`).length, writtenRows: items.filter((item) => item.sourceRunId === `run-bn-hist-${cutoverWeek.start}`).length, updatedRows: 0, skippedRows: 0, errorCode: null, errorSummary: null, datasetVersion: publishedVersion,
      pages: pages(6, 6), affectedWeeks: [cutoverWeek.label], retrySafe: true,
      evidenceSamples: sample(`run-bn-hist-${cutoverWeek.start}`, 4),
      logs: [{ at: at(54, 30), level: "info", message: "交界周班牛侧读取完成，等待与新工单对账" }],
    }),
    ...trendWeeks.slice(2).map((week, index) => base({
      runId: `run-ts-inc-${week.start}`, task: "新工单增量同步（历史窗口）", sourceSystem: "ticket_service", trigger: "backfill",
      windowStart: week.start, windowEnd: week.end, status: "succeeded", startedAt: at(60 + index * 12), finishedAt: at(60 + index * 12, -8), durationMs: 480_000,
      readRows: items.filter((item) => item.sourceRunId === `run-ts-inc-${week.start}`).length, writtenRows: items.filter((item) => item.sourceRunId === `run-ts-inc-${week.start}`).length, updatedRows: 0, skippedRows: 0, errorCode: null, errorSummary: null, datasetVersion: publishedVersion,
      pages: pages(3, 24), affectedWeeks: [week.label], retrySafe: true,
      evidenceSamples: sample(`run-ts-inc-${week.start}`, 3),
      logs: [{ at: at(60 + index * 12, -8), level: "info", message: "窗口完整，双读一致" }],
    })),
    base({
      runId: "run-bn-hist-w0", task: "班牛历史补数", sourceSystem: "banniu", trigger: "backfill",
      windowStart: closedWeeks[0].start, windowEnd: closedWeeks[0].end, status: "succeeded", startedAt: at(100), finishedAt: at(99, 30), durationMs: 1_800_000,
      readRows: 60, writtenRows: 60, updatedRows: 0, skippedRows: 0, errorCode: null, errorSummary: null, datasetVersion: publishedVersion,
      pages: pages(12, 5), affectedWeeks: [closedWeeks[0].label], retrySafe: true,
      evidenceSamples: sample("run-bn-hist-w0", 3),
    }),
    base({
      runId: `run-ts-inc-${cutoverWeek.start}`, task: "新工单增量同步（历史窗口）", sourceSystem: "ticket_service", trigger: "backfill",
      windowStart: cutoverWeek.start, windowEnd: cutoverWeek.end, status: "succeeded", startedAt: at(56), finishedAt: at(55, 40), durationMs: 600_000,
      readRows: items.filter((item) => item.sourceRunId === `run-ts-inc-${cutoverWeek.start}`).length, writtenRows: items.filter((item) => item.sourceRunId === `run-ts-inc-${cutoverWeek.start}`).length, updatedRows: 0, skippedRows: 0, errorCode: null, errorSummary: null, datasetVersion: publishedVersion,
      pages: pages(2, 24), affectedWeeks: [cutoverWeek.label], retrySafe: true,
      evidenceSamples: sample(`run-ts-inc-${cutoverWeek.start}`, 3),
    }),
    base({
      runId: `run-ts-inc-${trendWeeks[0].start}`, task: "新工单增量同步（历史窗口）", sourceSystem: "ticket_service", trigger: "backfill",
      windowStart: trendWeeks[0].start, windowEnd: trendWeeks[0].end, status: "succeeded", startedAt: at(58), finishedAt: at(57, 50), durationMs: 120_000,
      readRows: 0, writtenRows: 0, updatedRows: 0, skippedRows: 0, errorCode: null, errorSummary: null, datasetVersion: publishedVersion,
      pages: pages(1, 0), affectedWeeks: [trendWeeks[0].label], retrySafe: true,
    }),
  ]
}
