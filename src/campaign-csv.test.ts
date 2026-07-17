import { describe, expect, test } from "vitest"

import {
  CAMPAIGN_CSV_MAX_ROWS,
  campaignCsvTemplate,
  exportCampaignLeadsCsv,
  parseCampaignCsv,
  spreadsheetSafeText,
} from "./lib/campaign-csv"

describe("parseCampaignCsv", () => {
  test("parses semicolon-delimited UTF-8 with German header aliases", () => {
    const parsed = parseCampaignCsv(
      "\uFEFFFirma;Webseite;Branche;Stadt;Geschäfts-E-Mail\r\n" +
        'Müller & Söhne;https://mueller.de;Bäckerei;Köln;hallo@mueller.de',
    )

    expect(parsed.delimiter).toBe(";")
    expect(parsed.rows).toEqual([
      {
        rowNumber: 2,
        businessName: "Müller & Söhne",
        websiteUrl: "https://mueller.de",
        category: "Bäckerei",
        city: "Köln",
        businessEmail: "hallo@mueller.de",
        country: undefined,
        address: undefined,
        phone: undefined,
      },
    ])
  })

  test("parses commas, escaped quotes and newlines in quoted fields", () => {
    const parsed = parseCampaignCsv(
      'Company Name,URL,Address\n"Acme, Inc.",acme.test,"Line 1\nLine 2"',
    )
    expect(parsed.rows[0]).toMatchObject({
      businessName: "Acme, Inc.",
      websiteUrl: "acme.test",
      address: "Line 1\nLine 2",
    })
  })

  test("accepts exactly 100 data rows and rejects the 101st", () => {
    const rows = Array.from({ length: CAMPAIGN_CSV_MAX_ROWS }, (_, index) => `Firma ${index + 1}`)
    expect(parseCampaignCsv(["Firma", ...rows].join("\n")).rows).toHaveLength(100)
    expect(() => parseCampaignCsv(["Firma", ...rows, "Zu viel"].join("\n"))).toThrow(/maximal 100/)
  })

  test("provides a parseable UTF-8 template", () => {
    expect(parseCampaignCsv(campaignCsvTemplate()).rows[0]).toMatchObject({
      businessName: "Beispiel GmbH",
      city: "Berlin",
    })
  })
})

describe("exportCampaignLeadsCsv", () => {
  test("uses BOM and semicolons and prevents spreadsheet formula injection", () => {
    const csv = exportCampaignLeadsCsv([
      {
        businessName: "=CMD|' /C calc'!A0",
        websiteUrl: "+malicious.example",
        note: '@HYPERLINK("https://bad.example")',
        status: "new",
      },
    ])

    expect(csv.startsWith("\uFEFFUnternehmensname;Website")).toBe(true)
    expect(csv).toContain("'=CMD")
    expect(csv).toContain("'+malicious.example")
    expect(csv).toContain("'@HYPERLINK")
  })
})

describe("spreadsheetSafeText", () => {
  test("escapes formula prefixes for CSV and Google Sheets RAW exports", () => {
    expect(spreadsheetSafeText("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)")
    expect(spreadsheetSafeText("\t@HYPERLINK(\"https://bad.example\")")).toBe(
      "'\t@HYPERLINK(\"https://bad.example\")",
    )
    expect(spreadsheetSafeText("SitePitch GmbH")).toBe("SitePitch GmbH")
  })
})
