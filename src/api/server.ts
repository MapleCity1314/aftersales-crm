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
 * - 配置了 `AFTERSALES_API_BASE_URL` 时走 Hono `/api/v1`。
 * - 否则在非生产环境使用受控样例数据；生产环境缺少配置视为部署错误。
 */
export function resolveApiMode(): ApiMode {
  const explicit = process.env.AFTERSALES_API_MODE
  if (explicit === "mock" || explicit === "http") return explicit
  if (process.env.AFTERSALES_API_BASE_URL) return "http"
  if (process.env.NODE_ENV === "production") {
    throw new Error("AFTERSALES_API_BASE_URL_MISSING: 生产环境必须配置 Hono 数据服务地址")
  }
  return "mock"
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
