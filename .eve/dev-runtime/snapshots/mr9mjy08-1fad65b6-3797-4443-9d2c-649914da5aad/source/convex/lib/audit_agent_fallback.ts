import type { CheckInput, CategoryScores } from "./audit_scoring"
import { CATEGORY_WEIGHTS, scoreBand, scoreLabel } from "./audit_scoring"
import type { AuditAgentOutput, AuditFindingOutput, OutreachDraftOutput } from "./audit_agent_schemas"

export interface FallbackContext {
  domain: string
  reportLanguage: "de" | "en"
  reportLink?: string
  workspaceName?: string
  contactName?: string
  categoryScores: CategoryScores
  overallScore: number
  checks: CheckInput[]
}

const DE_CATEGORY_TITLES: Record<string, string> = {
  conversion: "Kontaktaufnahme & Conversion",
  seo: "SEO-Grundlagen",
  local_seo: "Lokale Auffindbarkeit",
  performance: "Ladezeit & Performance",
  mobile: "Mobile Nutzung",
  trust: "Vertrauen & Glaubwürdigkeit",
  technical: "Technische Grundlagen",
}

const EN_CATEGORY_TITLES: Record<string, string> = {
  conversion: "Contact & conversion",
  seo: "SEO basics",
  local_seo: "Local findability",
  performance: "Load time & performance",
  mobile: "Mobile experience",
  trust: "Trust & credibility",
  technical: "Technical basics",
}

function severityForStatus(status: CheckInput["status"], weight?: number): "low" | "medium" | "high" {
  if (status === "failed" && (weight ?? 0) >= 1) return "high"
  if (status === "failed") return "medium"
  return "low"
}

function pickTopIssues(checks: CheckInput[], limit: number): CheckInput[] {
  return checks
    .filter((check) => check.status === "failed" || check.status === "warning")
    .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
    .slice(0, limit)
}

function pickStrengths(checks: CheckInput[], limit: number): CheckInput[] {
  return checks.filter((check) => check.status === "passed").slice(0, limit)
}

function deFinding(check: CheckInput): AuditFindingOutput {
  const categoryTitle = DE_CATEGORY_TITLES[check.category] ?? check.category
  return {
    category: check.category as AuditFindingOutput["category"],
    severity: severityForStatus(check.status, check.weight),
    title: check.label,
    evidence: check.evidence ?? check.label,
    explanation: `${categoryTitle}: ${check.label} weist Optimierungspotenzial auf.`,
    recommendation: `Empfehlung: ${check.label} gezielt verbessern, um mehr Anfragen aus bestehenden Besuchern zu gewinnen.`,
    salesAngle: `Ein konkreter Ansatzpunkt, um bestehenden Traffic besser in Anfragen zu verwandeln.`,
  }
}

function enFinding(check: CheckInput): AuditFindingOutput {
  const categoryTitle = EN_CATEGORY_TITLES[check.category] ?? check.category
  return {
    category: check.category as AuditFindingOutput["category"],
    severity: severityForStatus(check.status, check.weight),
    title: check.label,
    evidence: check.evidence ?? check.label,
    explanation: `${categoryTitle}: ${check.label} shows room for improvement.`,
    recommendation: `Recommendation: improve ${check.label.toLowerCase()} to turn more existing visitors into enquiries.`,
    salesAngle: `A concrete starting point to convert existing traffic into more enquiries.`,
  }
}

function deSummary(ctx: FallbackContext, issues: CheckInput[], strengths: CheckInput[]) {
  const band = scoreBand(ctx.overallScore)
  const weakCategories = (Object.keys(ctx.categoryScores) as (keyof CategoryScores)[])
    .filter((cat) => ctx.categoryScores[cat] < 70)
    .map((cat) => DE_CATEGORY_TITLES[cat] ?? cat)

  const shortSummary =
    band === "critical" || band === "weak"
      ? `Die Website von ${ctx.domain} zeigt mehrere konkrete Optimierungspunkte${weakCategories.length ? ` (unter anderem ${weakCategories.slice(0, 3).join(", ")})` : ""}, die sich mit überschaubarem Aufwand verbessern lassen.`
      : `Die Website von ${ctx.domain} macht einen soliden Eindruck, verschenkt aber an einzelnen Stellen Potenzial.`

  return {
    shortSummary,
    strengths: strengths.length
      ? strengths.map((check) => `${check.label} ist bereits gut aufgestellt.`)
      : ["Grundlegende Struktur der Website ist vorhanden."],
    weaknesses: issues.slice(0, 5).map((check) => `${check.label} lässt sich verbessern.`),
    topOpportunities: issues.slice(0, 3).map((check) => `${check.label} optimieren für mehr Anfragen.`),
    nextSteps: issues.slice(0, 4).map((check, index) => `${index + 1}. ${check.label} angehen.`),
  }
}

function enSummary(ctx: FallbackContext, issues: CheckInput[], strengths: CheckInput[]) {
  const band = scoreBand(ctx.overallScore)
  const weakCategories = (Object.keys(ctx.categoryScores) as (keyof CategoryScores)[])
    .filter((cat) => ctx.categoryScores[cat] < 70)
    .map((cat) => EN_CATEGORY_TITLES[cat] ?? cat)

  const shortSummary =
    band === "critical" || band === "weak"
      ? `The website ${ctx.domain} shows several concrete improvement areas${weakCategories.length ? ` (including ${weakCategories.slice(0, 3).join(", ")})` : ""} that can be addressed with manageable effort.`
      : `The website ${ctx.domain} makes a solid impression but leaves room for improvement in a few spots.`

  return {
    shortSummary,
    strengths: strengths.length
      ? strengths.map((check) => `${check.label} is already well set up.`)
      : ["Basic website structure is in place."],
    weaknesses: issues.slice(0, 5).map((check) => `${check.label} can be improved.`),
    topOpportunities: issues.slice(0, 3).map((check) => `Improve ${check.label.toLowerCase()} for more enquiries.`),
    nextSteps: issues.slice(0, 4).map((check, index) => `${index + 1}. Address ${check.label.toLowerCase()}.`),
  }
}

function deOutreach(ctx: FallbackContext): OutreachDraftOutput[] {
  const link = ctx.reportLink ? `\n\nAudit-Link: ${ctx.reportLink}` : ""
  const sender = ctx.workspaceName ?? "[Absender]"
  return [
    {
      type: "email",
      subject: `Kurzer Website-Audit zu ${ctx.domain}`,
      body: `Hallo Team,\n\nich habe mir ${ctx.domain} kurz angeschaut und dabei einige konkrete Punkte entdeckt, die sich mit überschaubarem Aufwand verbessern lassen – besonders bei Kontaktaufnahme, lokaler Auffindbarkeit und Performance.\n\nIch habe daraus einen kurzen Audit erstellt.${link}\n\nVielleicht ist das für Sie interessant, unabhängig davon, ob Sie gerade aktiv über Ihre Website nachdenken.\n\nViele Grüße\n${sender}`,
    },
    {
      type: "linkedin",
      body: `Hallo, ich habe mir ${ctx.domain} kurz angesehen und dabei ein paar konkrete Verbesserungschancen entdeckt (Score ${ctx.overallScore}/100). Ich teile gerne einen kurzen Audit dazu – unabhängig davon, ob gerade ein Relaunch ansteht.${link}`,
    },
    {
      type: "phone_note",
      body: `Anruf-Notiz ${ctx.domain}: Website-Audit erstellt (Score ${ctx.overallScore}/100). Konkrete Punkte bei Kontaktaufnahme, lokaler Auffindbarkeit und Performance. Audit-Link bereithalten und freundlich auf vorhandenes Potenzial eingehen.`,
    },
    {
      type: "follow_up",
      body: `Hallo, kurze Nachfrage zum Audit für ${ctx.domain}: Hat es denn einen guten Eindruck hinterlassen? Gerne stelle ich die Punkte individuell vor.${link}`,
    },
  ]
}

function enOutreach(ctx: FallbackContext): OutreachDraftOutput[] {
  const link = ctx.reportLink ? `\n\nAudit link: ${ctx.reportLink}` : ""
  const sender = ctx.workspaceName ?? "[Your name]"
  return [
    {
      type: "email",
      subject: `Short website audit for ${ctx.domain}`,
      body: `Hi team,\n\nI took a quick look at ${ctx.domain} and found a few concrete points that could be improved with manageable effort – particularly around contact options, local findability, and performance.\n\nI put together a short audit from it.${link}\n\nWorth a look whether or not you're actively thinking about a relaunch right now.\n\nBest,\n${sender}`,
    },
    {
      type: "linkedin",
      body: `Hi, I took a quick look at ${ctx.domain} and found a few concrete improvement opportunities (score ${ctx.overallScore}/100). Happy to share a short audit – whether or not a relaunch is on your radar.${link}`,
    },
    {
      type: "phone_note",
      body: `Call note ${ctx.domain}: prepared a website audit (score ${ctx.overallScore}/100). Concrete points around contact options, local findability and performance. Keep the audit link ready and lead with the existing potential.`,
    },
    {
      type: "follow_up",
      body: `Hi, quick follow-up on the audit for ${ctx.domain}: did it leave a useful impression? Happy to walk through the points individually.${link}`,
    },
  ]
}

export function generateDeterministicAgentOutput(ctx: FallbackContext): AuditAgentOutput {
  const issues = pickTopIssues(ctx.checks, 8)
  const strengths = pickStrengths(ctx.checks, 5)
  const isEnglish = ctx.reportLanguage === "en"

  const findings = (issues.length ? issues : ctx.checks.slice(0, 3)).map((check) =>
    isEnglish ? enFinding(check) : deFinding(check),
  )

  const summary = isEnglish ? enSummary(ctx, issues, strengths) : deSummary(ctx, issues, strengths)
  const outreach = isEnglish ? enOutreach(ctx) : deOutreach(ctx)

  const subjectLines = isEnglish
    ? [
        `Short website audit for ${ctx.domain}`,
        `A few concrete points for ${ctx.domain}`,
        `Website score ${ctx.overallScore}/100 – quick audit`,
      ]
    : [
        `Kurzer Website-Audit zu ${ctx.domain}`,
        `Einige konkrete Punkte für ${ctx.domain}`,
        `Website-Score ${ctx.overallScore}/100 – kurzer Audit`,
      ]

  return {
    findings,
    summary,
    outreach,
    subjectLines,
  }
}

export function describeCategoryScores(ctx: FallbackContext): { category: string; score: number; label: string }[] {
  return (Object.keys(ctx.categoryScores) as (keyof CategoryScores)[]).map((category) => ({
    category,
    score: ctx.categoryScores[category],
    label: scoreLabel(ctx.categoryScores[category]),
  }))
}

export const FALLBACK_PROVIDER = "other"
export const FALLBACK_MODEL = "deterministic-fallback"
export const CATEGORY_WEIGHTS_SNAPSHOT = CATEGORY_WEIGHTS
