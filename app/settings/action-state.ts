export interface RuleActionState {
  status: "idle" | "success" | "error"
  message: string | null
  ruleId: string | null
}

export const idleRuleActionState: RuleActionState = { status: "idle", message: null, ruleId: null }
