import { NextResponse, type NextRequest } from "next/server"

import { DEV_ROLE_COOKIE } from "@/src/auth/constants"

const publicSuffixes = ["/healthz", "/readyz"]

/**
 * 员工身份由公司网关注入。生产环境缺少头部直接 401。
 * 非生产环境在没有网关时注入“本地验收”身份，角色可用开发 cookie 切换，用于演示无权访问状态。
 */
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname
  const publicRequest = publicSuffixes.some((suffix) => path.endsWith(suffix)) || path.includes("/_next/")
  if (publicRequest) return NextResponse.next()

  const userId = request.headers.get("x-company-user-id")?.trim()
  const userName = request.headers.get("x-company-user-name")?.trim()
  const role = request.headers.get("x-company-role")?.trim()
  const valid = Boolean(userId && userName && (role === "admin" || role === "viewer"))

  if (!valid && process.env.NODE_ENV !== "production") {
    const devRole = request.cookies.get(DEV_ROLE_COOKIE)?.value === "viewer" ? "viewer" : "admin"
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set("x-company-user-id", "local-acceptance")
    requestHeaders.set("x-company-user-name", encodeURIComponent("本地验收"))
    requestHeaders.set("x-company-role", devRole)
    requestHeaders.set("x-company-identity-source", "local-dev")
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  if (!valid) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "请从公司员工统一入口登录" } },
      { status: 401, headers: { "cache-control": "no-store" } },
    )
  }
  return NextResponse.next()
}
