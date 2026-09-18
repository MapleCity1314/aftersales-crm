import type { Metadata, Viewport } from "next"
import type { ReactNode } from "react"

import { AppShell } from "@/src/components/app-shell"
import { z0Mono, z0Sans, z0Serif } from "./fonts"

import "./globals.css"

export const metadata: Metadata = {
  title: "售后经营平台",
  description: "榆园售后经营数据平台：有来源、有证据、有批次、有更新时间",
  icons: {
    icon: [
      { url: "/aftersales/brand/yuyuan-mark-light.png", media: "(prefers-color-scheme: light)" },
      { url: "/aftersales/brand/yuyuan-mark-dark.png", media: "(prefers-color-scheme: dark)" },
    ],
    apple: "/aftersales/brand/yuyuan-mark-light.png",
  },
}

export const viewport: Viewport = { themeColor: "#12392c", width: "device-width", initialScale: 1 }

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className={`${z0Sans.variable} ${z0Serif.variable} ${z0Mono.variable}`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
