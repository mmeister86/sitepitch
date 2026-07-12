import { getAuditExample } from "../../../src/lib/audit-examples"

export const dynamic = "force-static"

const HTML_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
}

function escapeHtml(value: string | number): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function list(items: readonly string[], ordered = false): string {
  const tag = ordered ? "ol" : "ul"
  return `<${tag}>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</${tag}>`
}

function documentShell(title: string, body: string): string {
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>${escapeHtml(title)} | SitePitch Beispiel</title>
  <style>
    :root{color-scheme:light;--ink:#18181b;--muted:#71717a;--line:#e4e4e7;--soft:#f4f4f5;--brand:#5b5bd6;--high:#b42318;--medium:#b54708}*{box-sizing:border-box}body{margin:0;background:#fafafa;color:var(--ink);font:15px/1.55 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wrap{width:min(980px,calc(100% - 32px));margin:0 auto;padding:28px 0 64px}.top,.hero,.card{background:#fff;border:1px solid var(--line);border-radius:16px}.top{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 16px;margin-bottom:16px}.top div{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.badge{display:inline-flex;border-radius:999px;background:#ececff;color:#3f3fa4;padding:3px 9px;font-size:12px;font-weight:700}.muted{color:var(--muted)}a{color:var(--brand);font-weight:650;text-decoration:none}a:hover{text-decoration:underline}.button{display:inline-flex;border-radius:10px;background:var(--brand);color:#fff;padding:9px 13px}.button:hover{text-decoration:none;filter:brightness(.95)}.hero{padding:24px;margin-bottom:16px}.eyebrow{margin:0;color:var(--muted);font-size:13px}.hero h1{margin:4px 0 5px;font-size:clamp(25px,4vw,38px);line-height:1.15}.score{font-size:38px;font-weight:800;color:var(--brand)}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.card{padding:20px}.wide{grid-column:1/-1}h2{font-size:18px;margin:0 0 12px}h3{font-size:15px;margin:18px 0 7px}ul,ol{margin:0;padding-left:20px}.scores{display:grid;gap:10px}.score-row{display:grid;grid-template-columns:minmax(110px,1fr) 3fr 36px;align-items:center;gap:10px}.bar{height:8px;background:var(--soft);border-radius:999px;overflow:hidden}.bar span{display:block;height:100%;background:var(--brand)}.finding{border-top:1px solid var(--line);padding-top:16px;margin-top:16px}.finding:first-of-type{border-top:0;padding-top:0;margin-top:0}.severity{font-size:11px;font-weight:800;text-transform:uppercase}.severity.high{color:var(--high)}.severity.medium{color:var(--medium)}.finding p{margin:5px 0}.footer{margin-top:18px;text-align:center;color:var(--muted);font-size:12px}@media(max-width:700px){.grid{grid-template-columns:1fr}.wide{grid-column:auto}.top{align-items:flex-start;flex-direction:column}.score-row{grid-template-columns:105px 1fr 30px}}
  </style>
</head>
<body>${body}</body>
</html>`
}

function renderExample(slug: string): Response {
  const example = getAuditExample(slug)
  if (!example) {
    const body = `<main class="wrap"><section class="card"><span class="badge">404</span><h1>Beispiel nicht gefunden</h1><p class="muted">Dieser Beispielreport ist nicht verfügbar.</p><a href="/">Zurück zu SitePitch</a></section></main>`
    return new Response(documentShell("Nicht gefunden", body), {
      status: 404,
      headers: { "Content-Type": HTML_HEADERS["Content-Type"], "Cache-Control": "no-store" },
    })
  }

  const { report } = example
  const scoreRows = report.categoryScores
    .map(
      (score) => `<div class="score-row"><span>${escapeHtml(score.label)}</span><span class="bar"><span style="width:${escapeHtml(score.score)}%"></span></span><strong>${escapeHtml(score.score)}</strong></div>`,
    )
    .join("")
  const findings = report.findings
    .map(
      (finding) => `<article class="finding"><span class="severity ${escapeHtml(finding.severity)}">${escapeHtml(finding.severity)}</span><h3>${escapeHtml(finding.title)}</h3><p><strong>Beleg:</strong> ${escapeHtml(finding.evidence)}</p><p class="muted">${escapeHtml(finding.explanation)}</p><p><strong>Empfehlung:</strong> ${escapeHtml(finding.recommendation)}</p></article>`,
    )
    .join("")
  const body = `<main class="wrap">
    <nav class="top" aria-label="Beispielnavigation"><div><a href="/">← Zurück</a><span class="badge">Beispiel</span><span class="muted">statisch · schreibgeschützt · ohne Tracking</span></div><a class="button" href="/app/audits/new">Eigenen Audit starten →</a></nav>
    <header class="hero"><p class="eyebrow">${escapeHtml(example.industry)} · ${escapeHtml(report.domain)}</p><h1>${escapeHtml(example.title)}</h1><div><span class="score">${escapeHtml(report.overallScore)}</span><span class="muted"> / 100 Gesamtscore</span></div><p>${escapeHtml(report.summary.shortSummary)}</p></header>
    <div class="grid">
      <section class="card wide"><h2>Kategorie-Scores</h2><div class="scores">${scoreRows}</div></section>
      <section class="card"><h2>Stärken</h2>${list(report.summary.strengths)}</section>
      <section class="card"><h2>Top-Chancen</h2>${list(report.summary.topOpportunities, true)}</section>
      <section class="card wide"><h2>Findings</h2>${findings}</section>
      <section class="card wide"><h2>Nächste Schritte</h2>${list(report.nextSteps, true)}</section>
    </div>
    <p class="footer">Fiktive Unternehmensdaten für einen unveränderlichen SitePitch-Beispielreport.</p>
  </main>`
  return new Response(documentShell(example.title, body), { status: 200, headers: HTML_HEADERS })
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await context.params
  return renderExample(slug)
}
