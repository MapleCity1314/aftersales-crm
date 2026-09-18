import "server-only"

import { cookies } from "next/headers"

import { currentUser } from "@/src/auth/current-user"

import { createHttpApiClient } from "./adapters/http"
import { createMockApiClient } from "./adapters/mock"
import type { ApiClient } from "./client"

export const MOCK_SCENARIO_COOKIE = "aftersales_mock_scenario"

export type ApiMode = "mock" | "http"

/**
 * 选择数据入口：
 * - 配置了 `AFTERSALES_API_BASE_URL`（或显式 `AFTERSALES_API_MODE=http`）时走 Hono `/api/v1`。
 * - 否则使用受控样例数据，页面可独立演示；接入后端时只需补环境变量，不改页面代码。
 */
export function resolveApiMode(): ApiMode {
  const explicit = process.env.AFTERSALES_API_MODE
  if (explicit === "mock" || explicit === "http") return explicit
  if (process.env.AFTERSALES_API_BASE_URL) return "http"
  return "mock"
}

/**
 * 不依赖员工身份的探针入口，仅供 /readyz 等公开检查使用；只允许读取就绪状态。
 */
export function getProbeApi(): ApiClient {
  const identity = { userId: "system-probe", displayName: "readiness-probe", role: "viewer" as const }
  const mode = resolveApiMode()
  if (mode === "http") {
    return createHttpApiClient(process.env.AFTERSALES_API_BASE_URL!, process.env.NEXT_PUBLIC_AFTERSALES_API_BASE_URL ?? null, { identity })
  }
  return createMockApiClient({ identity, scenario: null })
}

export async function getApi(): Promise<ApiClient> {
  const identity = await currentUser()
  const mode = resolveApiMode()
  if (mode === "http") {
    return createHttpApiClient(
      process.env.AFTERSALES_API_BASE_URL!,
      process.env.NEXT_PUBLIC_AFTERSALES_API_BASE_URL ?? null,
      { identity: { userId: identity.id, displayName: identity.displayName, role: identity.role } },
    )
  }
  const cookieStore = await cookies()
  return createMockApiClient({
    identity: { userId: identity.id, displayName: identity.displayName, role: identity.role },
    scenario: cookieStore.get(MOCK_SCENARIO_COOKIE)?.value ?? null,
  })
}
