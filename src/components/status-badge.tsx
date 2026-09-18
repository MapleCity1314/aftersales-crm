import type { ClassificationStatus, RunStatus, SourceSystem, WarehouseMatchStatus, CheckStatus, DataState } from "@/src/api/contracts"

import {
  checkStatusLabel,
  checkStatusTone,
  classificationLabel,
  classificationTone,
  dataStateLabel,
  dataStateTone,
  runStatusLabel,
  runStatusTone,
  sourceLabel,
  warehouseMatchLabel,
} from "./format"

export type Tone = "neutral" | "good" | "warning" | "critical"

export function Badge({ tone = "neutral", children, title }: { tone?: Tone; children: React.ReactNode; title?: string }) {
  return <span className={`badge ${tone}`} title={title}><i aria-hidden="true" />{children}</span>
}

export function RunStatusBadge({ status }: { status: RunStatus }) {
  return <Badge tone={runStatusTone(status)}>{runStatusLabel(status)}</Badge>
}

export function CheckStatusBadge({ status }: { status: CheckStatus }) {
  return <Badge tone={checkStatusTone(status)}>{checkStatusLabel(status)}</Badge>
}

export function ClassificationBadge({ status }: { status: ClassificationStatus }) {
  return <Badge tone={classificationTone(status)}>{classificationLabel(status)}</Badge>
}

export function WarehouseMatchBadge({ status }: { status: WarehouseMatchStatus }) {
  const tone: Tone = status === "confirmed" ? "good" : status === "pending" ? "warning" : "neutral"
  return <Badge tone={tone}>{warehouseMatchLabel(status)}</Badge>
}

export function DataStateBadge({ state }: { state: DataState }) {
  return <Badge tone={dataStateTone(state)}>{dataStateLabel(state)}</Badge>
}

export function SourceTag({ source }: { source: SourceSystem | string | null | undefined }) {
  const key = source ?? "platform"
  return <span className={`source-tag ${key}`}>{sourceLabel(source)}</span>
}
