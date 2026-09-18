"use server"

import { revalidatePath } from "next/cache"

import { isApiError } from "@/src/api/client"
import type { RuleUpdateInput } from "@/src/api/contracts"
import { getApi } from "@/src/api/server"

export interface RuleActionState {
  status: "idle" | "success" | "error"
  message: string | null
  ruleId: string | null
}

export const idleRuleActionState: RuleActionState = { status: "idle", message: null, ruleId: null }

/**
 * 规则修改只经过 ApiClient 边界；写入、审计与重新发布由后端负责。
 */
export async function updateExclusionRule(_previous: RuleActionState, formData: FormData): Promise<RuleActionState> {
  const ruleId = String(formData.get("ruleId") ?? "")
  const intent = String(formData.get("intent") ?? "note")
  if (!ruleId) return { status: "error", message: "缺少规则 ID", ruleId: null }

  const note = String(formData.get("note") ?? "").trim()
  if (intent === "note" && note.length > 200) {
    return { status: "error", message: "说明不能超过 200 字", ruleId }
  }
  const input: RuleUpdateInput = intent === "enable" ? { enabled: true } : intent === "disable" ? { enabled: false } : { note }

  try {
    const api = await getApi()
    const result = await api.updateRule(ruleId, input)
    revalidatePath("/settings")
    revalidatePath("/", "layout")
    return { status: "success", message: result.meta.notice ?? "已保存，等待数据集重新发布", ruleId }
  } catch (error) {
    if (isApiError(error)) {
      return { status: "error", message: error.code === "FORBIDDEN" ? "当前角色无权修改规则（需要管理员）" : `${error.message}（${error.code}）`, ruleId }
    }
    return { status: "error", message: error instanceof Error ? error.message : "保存失败", ruleId }
  }
}
