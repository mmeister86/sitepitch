export const CAMPAIGN_CSV_MAX_BYTES = 1_000_000
export const CAMPAIGN_CSV_MAX_ROWS = 100
export const CAMPAIGN_IMPORT_BATCH_SIZE = 25

export type CampaignImportRow = {
  rowNumber: number
  businessName: string
  websiteUrl?: string
  category?: string
  city?: string
  country?: string
  address?: string
  phone?: string
  businessEmail?: string
}

export type CampaignImportClassification =
  | "valid_new"
  | "duplicate_existing"
  | "duplicate_in_file"
  | "invalid"

export type CampaignImportPreviewItem = CampaignImportRow & {
  classification: CampaignImportClassification
  error?: string
}

export type CampaignCsvExportRow = {
  businessName: string
  websiteUrl?: string
  category?: string
  city?: string
  country?: string
  address?: string
  phone?: string
  businessEmail?: string
  status?: string
  score?: number
  reportOpened?: boolean
  lastContactedAt?: number
  followUpAt?: number
  note?: string
  outcomeReason?: string
}

export type ParsedCampaignCsv = {
  delimiter: "," | ";"
  rows: CampaignImportRow[]
}

type CampaignCsvField = Exclude<keyof CampaignImportRow, "rowNumber">

const HEADER_ALIASES: Record<string, CampaignCsvField> = {
  unternehmensname: "businessName",
  firmenname: "businessName",
  firma: "businessName",
  company: "businessName",
  companyname: "businessName",
  businessname: "businessName",
  name: "businessName",
  website: "websiteUrl",
  webseite: "websiteUrl",
  websiteurl: "websiteUrl",
  url: "websiteUrl",
  domain: "websiteUrl",
  branche: "category",
  kategorie: "category",
  industry: "category",
  category: "category",
  stadt: "city",
  ort: "city",
  city: "city",
  land: "country",
  country: "country",
  adresse: "address",
  anschrift: "address",
  address: "address",
  telefon: "phone",
  phone: "phone",
  telephone: "phone",
  email: "businessEmail",
  geschaeftsemail: "businessEmail",
  geschaftsemail: "businessEmail",
  businessmail: "businessEmail",
  businessemail: "businessEmail",
}

const EXPORT_HEADERS = [
  "Unternehmensname",
  "Website",
  "Branche",
  "Stadt",
  "Land",
  "Adresse",
  "Telefon",
  "E-Mail",
  "Status",
  "Score",
  "Report geöffnet",
  "Letzter Kontakt",
  "Follow-up",
  "Notiz",
  "Outcome",
] as const

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]/g, "")
}

function parseRecords(input: string, delimiter: "," | ";"): string[][] {
  const records: string[][] = []
  let record: string[] = []
  let field = ""
  let quoted = false

  for (let index = 0; index < input.length; index++) {
    const char = input[index]

    if (quoted) {
      if (char === '"' && input[index + 1] === '"') {
        field += '"'
        index++
      } else if (char === '"') {
        quoted = false
      } else {
        field += char
      }
      continue
    }

    if (char === '"' && field.length === 0) {
      quoted = true
    } else if (char === delimiter) {
      record.push(field)
      field = ""
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[index + 1] === "\n") index++
      record.push(field)
      if (record.some((value) => value.trim() !== "")) records.push(record)
      record = []
      field = ""
    } else {
      field += char
    }
  }

  if (quoted) throw new Error("Die CSV-Datei enthält ein nicht geschlossenes Anführungszeichen.")
  record.push(field)
  if (record.some((value) => value.trim() !== "")) records.push(record)
  return records
}

function countDelimiter(input: string, delimiter: "," | ";"): number {
  let count = 0
  let quoted = false
  for (let index = 0; index < input.length; index++) {
    const char = input[index]
    if (char === '"') {
      if (quoted && input[index + 1] === '"') index++
      else quoted = !quoted
    } else if (!quoted && char === delimiter) {
      count++
    } else if (!quoted && (char === "\n" || char === "\r")) {
      break
    }
  }
  return count
}

function trimOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export function parseCampaignCsv(input: string): ParsedCampaignCsv {
  if (new TextEncoder().encode(input).byteLength > CAMPAIGN_CSV_MAX_BYTES) {
    throw new Error("Die CSV-Datei darf maximal 1 MB groß sein.")
  }
  const text = input.replace(/^\uFEFF/, "")

  const delimiter: "," | ";" = countDelimiter(text, ";") > countDelimiter(text, ",") ? ";" : ","
  const records = parseRecords(text, delimiter)
  if (records.length === 0) throw new Error("Die CSV-Datei ist leer.")

  const header = records[0].map((value) => HEADER_ALIASES[normalizeHeader(value)])
  if (!header.includes("businessName")) {
    throw new Error("Die CSV-Datei benötigt eine Spalte für den Unternehmensnamen.")
  }

  const dataRecords = records.slice(1)
  if (dataRecords.length > CAMPAIGN_CSV_MAX_ROWS) {
    throw new Error(`Die CSV-Datei darf maximal ${CAMPAIGN_CSV_MAX_ROWS} Datenzeilen enthalten.`)
  }

  const rows = dataRecords.map((record, index): CampaignImportRow => {
    const values: Partial<Record<CampaignCsvField, string>> = {}
    header.forEach((fieldName, columnIndex) => {
      if (fieldName && values[fieldName] === undefined) values[fieldName] = record[columnIndex] ?? ""
    })
    return {
      rowNumber: index + 2,
      businessName: values.businessName?.trim() ?? "",
      websiteUrl: trimOptional(values.websiteUrl),
      category: trimOptional(values.category),
      city: trimOptional(values.city),
      country: trimOptional(values.country),
      address: trimOptional(values.address),
      phone: trimOptional(values.phone),
      businessEmail: trimOptional(values.businessEmail),
    }
  })

  return { delimiter, rows }
}

export function spreadsheetSafeText(value: string): string {
  return /^[\t\r]*[=+\-@]/.test(value) ? `'${value}` : value
}

function csvCell(value: unknown): string {
  const text = spreadsheetSafeText(value === undefined || value === null ? "" : String(value))
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function isoDate(value?: number): string {
  return value === undefined ? "" : new Date(value).toISOString()
}

export function exportCampaignLeadsCsv(rows: CampaignCsvExportRow[]): string {
  const lines = [EXPORT_HEADERS.map(csvCell).join(";")]
  for (const row of rows) {
    lines.push(
      [
        row.businessName,
        row.websiteUrl,
        row.category,
        row.city,
        row.country,
        row.address,
        row.phone,
        row.businessEmail,
        row.status,
        row.score,
        row.reportOpened === undefined ? "" : row.reportOpened ? "ja" : "nein",
        isoDate(row.lastContactedAt),
        isoDate(row.followUpAt),
        row.note,
        row.outcomeReason,
      ]
        .map(csvCell)
        .join(";"),
    )
  }
  return `\uFEFF${lines.join("\r\n")}`
}

export function campaignCsvTemplate(): string {
  return [
    "\uFEFFUnternehmensname;Website;Branche;Stadt;Land;Adresse;Telefon;E-Mail",
    "Beispiel GmbH;https://example.de;Webdesign;Berlin;Deutschland;Musterstraße 1;+49 30 123456;kontakt@example.de",
  ].join("\r\n")
}
