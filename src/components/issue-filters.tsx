import { Search, X } from "lucide-react"
import Link from "next/link"

import type { IssueFacets, IssueFilters } from "@/src/api/contracts"
import { issueFiltersToEntries, issuesHref } from "@/src/api/query"

import { sourceLabel } from "./format"

const categoryOptions = ["快递问题", "库房问题", "买家问题", "产品问题", "运营问题", "待归类"] as const
const statusOptions: Array<{ value: NonNullable<IssueFilters["status"]>; label: string }> = [
  { value: "all", label: "全部" },
  { value: "included", label: "已纳入经营统计" },
  { value: "excluded", label: "可剔除" },
  { value: "unclassified", label: "待归类" },
]

const filterLabels: Record<string, string> = {
  week: "创建周",
  source: "来源",
  shop: "店铺",
  product: "产品",
  merchant_code: "商家编码",
  product_id: "商品 ID",
  p1: "一级问题",
  p2: "二级问题",
  p3: "三级问题",
  category: "分类",
  status: "统计状态",
  warehouse: "仓库",
  q: "关键词",
  sort: "排序",
}

/**
 * 原生 GET 表单：筛选条件全部写入 URL，刷新后可复现；
 * 二级/三级问题选项由服务端根据当前一级/二级筛选返回。
 */
export function IssueFilterForm({ filters, facets }: { filters: IssueFilters; facets: IssueFacets }) {
  return (
    <form className="filter-form" method="get" action="/issues" aria-label="问题筛选">
      <div className="filter-grid">
        <label>
          创建周
          <select name="week" defaultValue={filters.week ?? ""}>
            <option value="">全部周期</option>
            {facets.weeks.map((week) => <option key={week.start} value={week.start}>{week.label}</option>)}
          </select>
        </label>
        <label>
          来源
          <select name="source" defaultValue={filters.source ?? "all"}>
            <option value="all">全部来源</option>
            <option value="banniu">{sourceLabel("banniu")}</option>
            <option value="ticket_service">{sourceLabel("ticket_service")}</option>
          </select>
        </label>
        <label>
          店铺
          <select name="shop" defaultValue={filters.shop ?? ""}>
            <option value="">全部店铺</option>
            {facets.shops.map((shop) => <option key={shop} value={shop}>{shop}</option>)}
          </select>
        </label>
        <label>
          五大分类
          <select name="category" defaultValue={filters.category ?? "all"}>
            <option value="all">全部分类</option>
            {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </label>
        <label>
          统计状态
          <select name="status" defaultValue={filters.status ?? "all"}>
            {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label>
          仓库
          <select name="warehouse" defaultValue={filters.warehouse ?? ""}>
            <option value="">全部仓库</option>
            {facets.warehouses.map((warehouse) => (
              <option key={warehouse.code} value={warehouse.code}>{warehouse.name ?? warehouse.code}{warehouse.code.startsWith("未映射:") ? "（待映射）" : ""}</option>
            ))}
          </select>
        </label>
        <label>
          一级问题
          <select name="p1" defaultValue={filters.p1 ?? ""}>
            <option value="">全部</option>
            {facets.p1.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label>
          二级问题
          <select name="p2" defaultValue={filters.p2 ?? ""}>
            <option value="">全部</option>
            {facets.p2.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label>
          三级问题
          <select name="p3" defaultValue={filters.p3 ?? ""}>
            <option value="">全部</option>
            {facets.p3.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label>
          产品名称
          <input name="product" defaultValue={filters.product ?? ""} placeholder="仅用于展示/搜索" />
        </label>
        <label>
          商家编码
          <input name="merchant_code" defaultValue={filters.merchantCode ?? ""} placeholder="如 YY-XM-500" className="mono" />
        </label>
        <label>
          商品 ID
          <input name="product_id" defaultValue={filters.productId ?? ""} placeholder="平台商品 ID" className="mono" />
        </label>
        <label className="span-2">
          关键词
          <input name="q" defaultValue={filters.q ?? ""} placeholder="来源工单 ID / 订单号 / 运单号 / 问题描述" />
        </label>
        <label>
          排序
          <select name="sort" defaultValue={filters.sort ?? "created_desc"}>
            <option value="created_desc">创建时间 新→旧</option>
            <option value="created_asc">创建时间 旧→新</option>
            <option value="updated_desc">更新时间 新→旧</option>
          </select>
        </label>
      </div>
      <div className="filter-actions">
        <span className="muted">筛选、排序与分页均在服务端执行；结果与导出共用同一数据集版本。</span>
        <div className="filter-buttons">
          <Link className="button ghost" href="/issues">清空</Link>
          <button className="button primary" type="submit"><Search aria-hidden="true" size={14} /> 应用筛选</button>
        </div>
      </div>
    </form>
  )
}

/** 已生效的筛选条件，点击即可单独移除。 */
export function ActiveFilters({ filters }: { filters: IssueFilters }) {
  const entries = issueFiltersToEntries(filters)
  if (entries.length === 0) return null
  return (
    <div className="active-filters" aria-label="已生效筛选">
      {entries.map(([key, value]) => {
        const rest = Object.fromEntries(entries.filter(([candidate]) => candidate !== key))
        const href = `/issues${Object.keys(rest).length ? `?${new URLSearchParams(rest).toString()}` : ""}`
        const display = key === "source" ? sourceLabel(value) : key === "status" ? statusOptions.find((option) => option.value === value)?.label ?? value : key === "merchant_code" && value === "__unmatched__" ? "待匹配（无商家编码）" : value
        return (
          <Link key={key} href={href} title={`移除筛选：${filterLabels[key] ?? key}`}>
            {filterLabels[key] ?? key}：{display}
            <X aria-hidden="true" size={11} />
          </Link>
        )
      })}
      <Link href={issuesHref({})} title="清空全部筛选">清空全部</Link>
    </div>
  )
}
