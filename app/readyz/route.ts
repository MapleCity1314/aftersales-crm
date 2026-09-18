import { getProbeApi, resolveApiMode } from "@/src/api/server"

/**
 * 前端进程的就绪检查：只问数据入口（Hono /readyz 或样例适配器）是否有已发布且通过必需检查的数据集。
 * 不直接连接任何数据库或外部来源。
 */
export async function GET() {
  const headers = { "cache-control": "no-store" }
  try {
    const mode = resolveApiMode()
    const readiness = await getProbeApi().readiness()
    return Response.json(
      {
        ok: readiness.ok,
        service: "aftersales-frontend",
        apiMode: mode,
        database: readiness.database,
        freshness: readiness.freshness,
        requiredChecksPassed: readiness.requiredChecksPassed,
        dataset: readiness.dataset
          ? { version: readiness.dataset.version, state: readiness.dataset.state, publishedAt: readiness.dataset.publishedAt, coverageStart: readiness.dataset.coverageStart, coverageEnd: readiness.dataset.coverageEnd }
          : null,
      },
      { status: readiness.ok ? 200 : 503, headers },
    )
  } catch (error) {
    return Response.json(
      { ok: false, service: "aftersales-frontend", error: { code: "UPSTREAM_UNAVAILABLE", message: error instanceof Error ? error.message : "unknown" } },
      { status: 503, headers },
    )
  }
}
