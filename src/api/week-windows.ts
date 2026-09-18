import { addDays, format, startOfDay, startOfWeek, subDays, subWeeks } from "date-fns"

import type { WeekWindow } from "./contracts"

const ISO_DATE = "yyyy-MM-dd"

/** 以 Asia/Shanghai 解释“今天”，与服务器本地时区无关。 */
export function shanghaiToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now)
  const value = (type: string) => Number(parts.find((part) => part.type === type)!.value)
  return new Date(value("year"), value("month") - 1, value("day"))
}

/** 最近 `count` 个完整周（周日起算），按时间正序；`end` 为开区间。 */
export function closedWeekWindows(today = shanghaiToday(), count = 5): WeekWindow[] {
  const currentWeekStart = startOfWeek(startOfDay(today), { weekStartsOn: 0 })
  const lastCompleteStart = subWeeks(currentWeekStart, 1)
  return Array.from({ length: count }, (_, index) => {
    const start = subWeeks(lastCompleteStart, count - index - 1)
    const end = addDays(start, 7)
    return { start: format(start, ISO_DATE), end: format(end, ISO_DATE), label: `${format(start, "MMdd")}-${format(subDays(end, 1), "MMdd")}` }
  })
}
