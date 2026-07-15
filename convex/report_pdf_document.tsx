"use node"

import {
  Document,
  Image,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer"

import {
  isReportSectionVisible,
  type PublicReportDocumentModel,
} from "../src/lib/report-document"

export type PdfReportDocumentModel = Omit<PublicReportDocumentModel, "screenshots" | "branding"> & {
  screenshots: {
    desktop: string | null
    mobile: string | null
  }
  branding: PublicReportDocumentModel["branding"] & {
    logoUrl?: string
  }
}

const copy = {
  de: {
    report: "Website-Audit",
    overall: "Gesamtscore",
    categories: "Kategorie-Scores",
    summary: "Kurzfazit",
    opportunities: "Top-Chancen",
    strengths: "Stärken",
    weaknesses: "Schwächen",
    screenshots: "Website-Ansichten",
    findings: "Detail-Findings",
    evidence: "Evidenz",
    explanation: "Erklärung",
    recommendation: "Empfehlung",
    nextSteps: "Empfohlene nächste Schritte",
    disclaimer: "Dieser Report bewertet öffentlich sichtbare Signale zum Zeitpunkt des Audits. Er ist keine Rechts-, Datenschutz- oder Sicherheitsberatung und garantiert weder Umsatz noch Geschäftserfolg.",
    poweredBy: "Powered by SitePitch",
  },
  en: {
    report: "Website audit",
    overall: "Overall score",
    categories: "Category scores",
    summary: "Executive summary",
    opportunities: "Top opportunities",
    strengths: "Strengths",
    weaknesses: "Weaknesses",
    screenshots: "Website views",
    findings: "Detailed findings",
    evidence: "Evidence",
    explanation: "Explanation",
    recommendation: "Recommendation",
    nextSteps: "Recommended next steps",
    disclaimer: "This report assesses publicly visible signals at the time of the audit. It is not legal, privacy, or security advice and does not guarantee revenue or business results.",
    poweredBy: "Powered by SitePitch",
  },
} as const

function isInlineImage(value: string | null | undefined): value is string {
  return typeof value === "string" && /^data:image\/(png|jpe?g);base64,/i.test(value)
}

function stylesFor(report: PdfReportDocumentModel) {
  const editorial = report.theme.preset === "editorial"
  const minimal = report.theme.preset === "minimal"
  return StyleSheet.create({
    page: {
      paddingTop: 42,
      paddingBottom: 50,
      paddingHorizontal: editorial ? 48 : 38,
      fontFamily: "Helvetica",
      fontSize: 9.5,
      lineHeight: 1.45,
      color: report.theme.textColor,
      backgroundColor: report.theme.backgroundColor,
    },
    header: {
      borderTopWidth: minimal ? 1 : 4,
      borderTopColor: report.theme.primaryColor,
      borderBottomWidth: 1,
      borderBottomColor: "#d7d7d7",
      paddingTop: 15,
      paddingBottom: 14,
      marginBottom: 24,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    logo: { width: 34, height: 34, objectFit: "contain" },
    brandMark: {
      width: 34,
      height: 34,
      borderRadius: minimal ? 0 : 5,
      backgroundColor: report.theme.primaryColor,
      color: "#ffffff",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 15,
      fontWeight: 700,
    },
    brandName: { fontSize: 11, fontWeight: 700 },
    eyebrow: { color: "#696969", fontSize: 8 },
    domain: { fontSize: editorial ? 14 : 11, fontWeight: 700, textAlign: "right" },
    intro: {
      fontSize: editorial ? 17 : 12,
      lineHeight: 1.5,
      marginBottom: 24,
      color: report.theme.textColor,
    },
    grid: { flexDirection: "row", gap: 14, marginBottom: 18 },
    scorePanel: {
      width: "30%",
      minHeight: 100,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "#d7d7d7",
      padding: 14,
    },
    score: { fontSize: 30, fontWeight: 700, color: report.theme.primaryColor },
    categoryPanel: { width: "70%", borderWidth: 1, borderColor: "#d7d7d7", padding: 14 },
    section: { marginBottom: 20 },
    sectionTitle: {
      fontSize: editorial ? 16 : 12,
      fontWeight: 700,
      marginBottom: 9,
      color: report.theme.primaryColor,
    },
    categoryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },
    categoryLabel: { fontSize: 8.5 },
    categoryValue: { fontSize: 8.5, fontWeight: 700 },
    paragraph: { fontSize: 9.5, lineHeight: 1.55 },
    listItem: { flexDirection: "row", gap: 7, marginBottom: 5 },
    bullet: { color: report.theme.primaryColor, width: 12 },
    twoColumn: { flexDirection: "row", gap: 14 },
    column: { width: "50%" },
    image: { width: "100%", maxHeight: 290, objectFit: "contain", marginBottom: 10 },
    finding: {
      borderWidth: 1,
      borderColor: "#d7d7d7",
      padding: 13,
      marginBottom: 10,
    },
    findingTitle: { fontSize: 11, fontWeight: 700, marginBottom: 8 },
    fieldLabel: { color: report.theme.primaryColor, fontSize: 7.5, fontWeight: 700, marginTop: 5 },
    cta: {
      borderWidth: 1,
      borderColor: report.theme.primaryColor,
      padding: 15,
      marginTop: 4,
      marginBottom: 18,
    },
    ctaTitle: { fontSize: 11, fontWeight: 700, marginBottom: 4 },
    ctaLink: { color: report.theme.primaryColor, fontSize: 9, textDecoration: "none" },
    footer: {
      position: "absolute",
      bottom: 22,
      left: 38,
      right: 38,
      borderTopWidth: 1,
      borderTopColor: "#dedede",
      paddingTop: 7,
      color: "#777777",
      fontSize: 6.8,
      flexDirection: "row",
      justifyContent: "space-between",
    },
  })
}

function BulletList({ items, styles }: { items: string[]; styles: ReturnType<typeof stylesFor> }) {
  return items.map((item, index) => (
    <View key={`${index}-${item.slice(0, 20)}`} style={styles.listItem} wrap={false}>
      <Text style={styles.bullet}>•</Text>
      <Text style={styles.paragraph}>{item}</Text>
    </View>
  ))
}

export function BrandedReportPdf({ report }: { report: PdfReportDocumentModel }) {
  const t = copy[report.reportLanguage]
  const styles = stylesFor(report)
  const ctaHref = report.branding.ctaUrl || report.branding.website

  return (
    <Document
      title={`${t.report} – ${report.domain}`}
      author={report.branding.name}
      subject={t.report}
      creator="SitePitch"
      producer="SitePitch"
      language={report.reportLanguage}
    >
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header} fixed>
          <View style={styles.brandRow}>
            {isInlineImage(report.branding.logoUrl) ? (
              <Image src={report.branding.logoUrl} style={styles.logo} />
            ) : (
              <View style={styles.brandMark}><Text>{report.branding.name.charAt(0)}</Text></View>
            )}
            <View>
              <Text style={styles.brandName}>{report.branding.name}</Text>
              <Text style={styles.eyebrow}>{t.report}</Text>
            </View>
          </View>
          <Text style={styles.domain}>{report.domain}</Text>
        </View>

        {report.intro ? <Text style={styles.intro}>{report.intro}</Text> : null}

        {isReportSectionVisible(report, "score") ? (
          <View style={styles.grid} wrap={false}>
            <View style={styles.scorePanel}>
              <Text style={styles.score}>{report.overallScore ?? "–"}</Text>
              <Text style={styles.eyebrow}>{t.overall}</Text>
            </View>
            <View style={styles.categoryPanel}>
              <Text style={styles.sectionTitle}>{t.categories}</Text>
              {(report.categoryScores ?? []).map((category) => (
                <View key={category.key} style={styles.categoryRow}>
                  <Text style={styles.categoryLabel}>{category.label}</Text>
                  <Text style={styles.categoryValue}>{category.score}/100</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {report.summary && isReportSectionVisible(report, "summary") ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.summary}</Text>
            <Text style={styles.paragraph}>{report.summary.shortSummary}</Text>
          </View>
        ) : null}

        {report.summary && isReportSectionVisible(report, "opportunities") && report.summary.topOpportunities.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.opportunities}</Text>
            <BulletList items={report.summary.topOpportunities.slice(0, 5)} styles={styles} />
          </View>
        ) : null}

        {report.summary && isReportSectionVisible(report, "strengths_weaknesses") ? (
          <View style={[styles.section, styles.twoColumn]}>
            <View style={styles.column}>
              <Text style={styles.sectionTitle}>{t.strengths}</Text>
              <BulletList items={report.summary.strengths} styles={styles} />
            </View>
            <View style={styles.column}>
              <Text style={styles.sectionTitle}>{t.weaknesses}</Text>
              <BulletList items={report.summary.weaknesses} styles={styles} />
            </View>
          </View>
        ) : null}

        {isReportSectionVisible(report, "screenshots") && (isInlineImage(report.screenshots.desktop) || isInlineImage(report.screenshots.mobile)) ? (
          <View style={styles.section} break>
            <Text style={styles.sectionTitle}>{t.screenshots}</Text>
            {isInlineImage(report.screenshots.desktop) ? <Image src={report.screenshots.desktop} style={styles.image} /> : null}
            {isInlineImage(report.screenshots.mobile) ? <Image src={report.screenshots.mobile} style={styles.image} /> : null}
          </View>
        ) : null}

        {isReportSectionVisible(report, "findings") && report.findings.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.findings}</Text>
            {report.findings.map((finding) => (
              <View key={`${finding.sortOrder}-${finding.title}`} style={styles.finding} wrap={false}>
                <Text style={styles.findingTitle}>{finding.title}</Text>
                <Text style={styles.fieldLabel}>{t.evidence}</Text>
                <Text style={styles.paragraph}>{finding.evidence}</Text>
                <Text style={styles.fieldLabel}>{t.explanation}</Text>
                <Text style={styles.paragraph}>{finding.explanation}</Text>
                <Text style={styles.fieldLabel}>{t.recommendation}</Text>
                <Text style={styles.paragraph}>{finding.recommendation}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {isReportSectionVisible(report, "next_steps") && report.nextSteps.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.nextSteps}</Text>
            <BulletList items={report.nextSteps} styles={styles} />
          </View>
        ) : null}

        {isReportSectionVisible(report, "cta") ? (
          <View style={styles.cta} wrap={false}>
            <Text style={styles.ctaTitle}>{report.branding.ctaText || report.branding.name}</Text>
            {ctaHref ? <Link src={ctaHref} style={styles.ctaLink}>{ctaHref}</Link> : null}
            {!ctaHref && report.branding.contactEmail ? <Text>{report.branding.contactEmail}</Text> : null}
          </View>
        ) : null}

        <View style={styles.footer} fixed>
          <Text>{t.disclaimer}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber}/${totalPages}`} />
          {report.showPoweredBy ? <Text>{t.poweredBy}</Text> : null}
        </View>
      </Page>
    </Document>
  )
}

export async function renderBrandedReportPdf(report: PdfReportDocumentModel) {
  return await renderToBuffer(<BrandedReportPdf report={report} />)
}
