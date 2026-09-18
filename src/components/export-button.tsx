import { Download } from "lucide-react"

import type { ApiClient } from "@/src/api/client"

/**
 * 导出与页面共用同一数据集版本和筛选条件。
 * 仅在 Hono 提供 `/api/v1/export` 时可点击；样例数据模式下保留入口但禁用。
 */
export function ExportButton({ api, params, children }: { api: ApiClient; params: Record<string, string>; children: React.ReactNode }) {
  const href = api.exportUrl(params)
  if (!href) {
    return <span aria-disabled="true" className="button" title="接入 Hono /api/v1/export 后可用；样例数据模式不提供下载文件"><Download aria-hidden="true" size={15} /> {children}</span>
  }
  return <a className="button" href={href}><Download aria-hidden="true" size={15} /> {children}</a>
}
