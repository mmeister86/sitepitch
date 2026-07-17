"use client"

import { DemoAuditForm, type DemoAuditRequest } from "./demo-audit-form"
import type { DemoAuditResult } from "./demo-state"

export async function submitDemoAuditUnavailable(_request: DemoAuditRequest): Promise<DemoAuditResult> {
  throw new Error("Der Live-Demo-Dienst ist in dieser Umgebung noch nicht verbunden. Es wurde kein Audit gestartet.")
}

export function DemoClientBoundary() {
  return <DemoAuditForm submitAudit={submitDemoAuditUnavailable} />
}
