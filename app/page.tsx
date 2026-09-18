import { Activity, BadgePercent, ClipboardCheck, ClipboardList, HelpCircle, PackageCheck, ShoppingCart, Tags } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"

import { buildHref, issuesHref, type SearchParams } from "@/src/api/query"
import { getApi } from "@/src/api/server"
import { DatasetStrip } from "@/src/components/dataset-strip"
import { ExportButton } from "@/src/components/export-button"
import { KpiCard } from "@/src/components/metric-card"
import { CategoryBreakdown, ProductWatchlist, TrendTable, WarehouseRiskList } from "@/src/components/overview-panels"
import { RouteLoading } from "@/src/components/route-loading"
import { DataNotice, ErrorState } from "@/src/components/state-panels"
import { TrendChart } from "@/src/components/trend-chart"

type Props = { searchParams: Promise<SearchParams> }

export default function OverviewPage(props: Props) {
  return <Suspense fallback={<RouteLoading />}><OverviewContent {...props} /></Suspense>
}

async function OverviewContent({ searchParams }: Props) {
  const query = await searchParams
  const mode = query.period === "progress" ? "progress" : "closed"
  const selfHref = buildHref("/", mode === "progress" ? [["period", "progress"]] : [])

  let result: Awaited<ReturnType<Awaited<ReturnType<typeof getApi>>["overview"]>> | null = null
  let error: unknown = null
  let api: Awaited<ReturnType<typeof getApi>> | null = null
  try {
    api = await getApi()
    result = await api.overview({ period: mode })
  } catch (caught) {
    error = caught
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">OVERVIEW</span>
          <h2>经营总览</h2>
          <p>先看数据窗口、来源和发布版本，再看结论。每个指标都能进入带筛选条件的问题工作台。</p>
        </div>
        <div className="page-heading-actions">
          <div className="segmented" role="group" aria-label="周期切换">
            <Link className={mode === "closed" ? "selected" : undefined} href="/">完整周</Link>
            <Link className={mode === "progress" ? "selected" : undefined} href="/?period=progress">本周进度</Link>
          </div>
          {api && result ? <ExportButton api={api} params={{ view: "overview", period: mode, datasetVersion: result.meta.datasetVersion ?? "" }}>导出经营分析</ExportButton> : null}
        </div>
      </div>

      {error || !result ? (
        <ErrorState error={error} retryHref={selfHref} context="经营总览" />
      ) : (
        <>
          <DatasetStrip
            meta={result.meta}
            dataset={result.data.dataset}
            sources={result.data.sources}
            windowLabel={mode === "progress" ? `本周进度 ${result.data.period.current.start} 起，已结束 ${result.data.period.completedDays} 个自然日` : `分析周期 ${result.data.period.current.label}，对比 ${result.data.period.previous.label}`}
            extra={result.data.period.orderThrough ? <span>订单水位至 {result.data.period.orderThrough}</span> : null}
          />
          <DataNotice meta={result.meta} publishedAt={result.data.dataset.publishedAt} lagReason={result.data.kpis.orders.reason} />

          <section className="metric-grid" aria-label="核心指标">
            <KpiCard icon={ClipboardList} label="全量售后问题" metric={result.data.kpis.allIssues} href={issuesHref({ week: result.data.period.current.start })} note={`待归类 ${result.data.kpis.unclassifiedIssues.value ?? "—"} · 可剔除 ${result.data.kpis.excludedIssues.value ?? "—"}`} />
            <KpiCard icon={ClipboardCheck} label="经营异常问题" metric={result.data.kpis.operatingIssues} href={issuesHref({ week: result.data.period.current.start, status: "included" })} tone={(result.data.kpis.operatingIssues.delta ?? 0) > 0 ? "warning" : "good"} />
            <KpiCard icon={ShoppingCart} label="销售订单" metric={result.data.kpis.orders} higherIsWorse={false} note="order_facts 全店口径" />
            <KpiCard icon={PackageCheck} label="产品销量" metric={result.data.kpis.sales} higherIsWorse={false} />
            <KpiCard icon={BadgePercent} label="经营异常售后率" metric={result.data.kpis.operatingRate} kind="percent" tone={(result.data.kpis.operatingRate.value ?? 0) >= 2 ? "critical" : undefined} note="经营异常问题 ÷ 销售订单" />
            <KpiCard icon={Activity} label="售后率周环比" metric={result.data.kpis.rateWow} kind="percent" tone={(result.data.kpis.rateWow.value ?? 0) > 0 ? "warning" : "good"} />
            <KpiCard icon={HelpCircle} label="待归类问题" metric={result.data.kpis.unclassifiedIssues} href={issuesHref({ week: result.data.period.current.start, status: "unclassified" })} tone={(result.data.kpis.unclassifiedIssues.value ?? 0) > 0 ? "warning" : "good"} note="未归入五大分类，不静默并入" />
            <KpiCard icon={Tags} label="可剔除问题" metric={result.data.kpis.excludedIssues} href={issuesHref({ week: result.data.period.current.start, status: "excluded" })} higherIsWorse={false} note="按规则版本剔除" />
          </section>

          <article className="panel" style={{ marginTop: 14 }}>
            <div className="panel-heading">
              <div><span className="eyebrow">FIVE-WEEK TREND</span><h3>最近五个完整周</h3><p>周环比为售后率百分点差；分母缺失时显示 “—” 并注明原因。</p></div>
              <Link href={issuesHref({})}>进入问题工作台</Link>
            </div>
            <TrendChart trend={result.data.trend} cutoverStart={result.data.trend.find((point) => point.reconciliation)?.week.start ?? null} />
            <TrendTable trend={result.data.trend} />
          </article>

          <section className="three-col">
            <article className="panel">
              <div className="panel-heading"><div><span className="eyebrow">CATEGORIES</span><h3>五大问题分类</h3><p>{result.data.period.current.label} 经营异常问题分布</p></div></div>
              <CategoryBreakdown categories={result.data.categories} week={result.data.period.current.start} />
            </article>
            <article className="panel">
              <div className="panel-heading"><div><span className="eyebrow">PRODUCT WATCHLIST</span><h3>产品预警榜</h3></div><Link href="/products">产品周报</Link></div>
              <ProductWatchlist rows={result.data.productWatchlist} week={result.data.period.current.start} />
            </article>
            <article className="panel">
              <div className="panel-heading"><div><span className="eyebrow">WAREHOUSE RISK</span><h3>仓库风险榜</h3></div><Link href="/warehouses">仓库分析</Link></div>
              <WarehouseRiskList rows={result.data.warehouseRisk} week={result.data.period.current.start} />
            </article>
          </section>
        </>
      )}
    </>
  )
}
