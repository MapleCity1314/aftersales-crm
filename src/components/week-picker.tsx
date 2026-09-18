import Link from "next/link"

import type { WeekWindow } from "@/src/api/contracts"
import { buildHref } from "@/src/api/query"

/**
 * 完整周选择器。选中周写入 URL，刷新后可复现；交界周用虚线下划线提示。
 */
export function WeekPicker({
  pathname,
  weeks,
  selected,
  cutoverStart,
  extra = {},
}: {
  pathname: string
  weeks: WeekWindow[]
  selected: WeekWindow
  cutoverStart?: string | null
  extra?: Record<string, string | undefined>
}) {
  return (
    <nav className="week-picker" aria-label="选择分析周">
      {weeks.map((week) => {
        const isSelected = week.start === selected.start
        const className = [isSelected ? "selected" : "", week.start === cutoverStart ? "cutover" : ""].filter(Boolean).join(" ") || undefined
        return (
          <Link
            aria-current={isSelected ? "true" : undefined}
            className={className}
            href={buildHref(pathname, [], { ...extra, week: week.start })}
            key={week.start}
            title={week.start === cutoverStart ? `${week.label} · 班牛与新工单交界周` : week.label}
          >
            {week.label}
          </Link>
        )
      })}
    </nav>
  )
}
