"use client"

import { FlaskConical } from "lucide-react"

import { setDemoRole, setDemoScenario } from "@/app/demo-actions"

export function DemoControls({
  scenarios,
  scenario,
  role,
}: {
  scenarios: ReadonlyArray<{ id: string; label: string }>
  scenario: string
  role: "admin" | "viewer"
}) {
  return (
    <div className="demo-controls" aria-label="演示控制（仅样例数据模式）">
      <span className="demo-controls-label"><FlaskConical aria-hidden="true" size={13} /> 样例数据</span>
      <form action={setDemoScenario}>
        <label>
          <span className="sr-only">演示场景</span>
          <select defaultValue={scenario} name="scenario" onChange={(event) => event.currentTarget.form?.requestSubmit()}>
            {scenarios.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
      </form>
      <form action={setDemoRole}>
        <label>
          <span className="sr-only">演示角色</span>
          <select defaultValue={role} name="role" onChange={(event) => event.currentTarget.form?.requestSubmit()}>
            <option value="admin">admin</option>
            <option value="viewer">viewer</option>
          </select>
        </label>
      </form>
    </div>
  )
}
