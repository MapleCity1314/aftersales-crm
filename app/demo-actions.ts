"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"

import { MOCK_SCENARIO_COOKIE, resolveApiMode } from "@/src/api/server"
import { DEV_ROLE_COOKIE } from "@/src/auth/constants"

/* 演示控件只在受控样例数据模式下生效；接入 Hono 后自动消失。 */
function assertDemoAllowed() {
  if (resolveApiMode() !== "mock") {
    throw new Error("DEMO_CONTROLS_DISABLED")
  }
}

export async function setDemoScenario(formData: FormData) {
  assertDemoAllowed()
  const scenario = String(formData.get("scenario") ?? "default")
  const store = await cookies()
  if (scenario === "default") store.delete(MOCK_SCENARIO_COOKIE)
  else store.set(MOCK_SCENARIO_COOKIE, scenario, { path: "/", sameSite: "lax" })
  revalidatePath("/", "layout")
}

export async function setDemoRole(formData: FormData) {
  assertDemoAllowed()
  const role = String(formData.get("role") ?? "admin")
  const store = await cookies()
  if (role === "viewer") store.set(DEV_ROLE_COOKIE, "viewer", { path: "/", sameSite: "lax" })
  else store.delete(DEV_ROLE_COOKIE)
  revalidatePath("/", "layout")
}
