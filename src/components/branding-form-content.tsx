"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { toast } from "@/components/ui/sonner"
import { Palette, Check, Upload, X, ImageIcon } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { parseBrandingInput, type BrandingFieldErrors } from "@/lib/branding-validation"
import { shouldHydrateBrandingForm } from "@/lib/branding-form-state"
import { applyWorkspaceAccent } from "@/lib/workspace-accent"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"

const accents = [
  { name: "Indigo", value: "#5b5bd6" },
  { name: "Violett", value: "#7c3aed" },
  { name: "Blau", value: "#2563eb" },
  { name: "Smaragd", value: "#059669" },
  { name: "Bernstein", value: "#d97706" },
  { name: "Rosé", value: "#e11d48" },
]

function fieldErrorMessage(error: unknown): BrandingFieldErrors {
  if (
    typeof error === "object" &&
    error !== null &&
    "data" in error &&
    typeof (error as { data?: unknown }).data === "object" &&
    (error as { data?: { fieldErrors?: unknown } }).data !== null &&
    "fieldErrors" in (error as { data: { fieldErrors?: unknown } }).data &&
    typeof (error as { data: { fieldErrors?: unknown } }).data.fieldErrors === "object" &&
    (error as { data: { fieldErrors?: unknown } }).data.fieldErrors !== null
  ) {
    return (error as { data: { fieldErrors: BrandingFieldErrors } }).data.fieldErrors
  }
  return {}
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs font-medium text-destructive">{message}</p>
}

export function BrandingFormContent() {
  const data = useQuery(api.workspaces.getMyWorkspace)
  const updateBranding = useMutation(api.workspaces.updateBranding)
  const generateLogoUploadUrl = useMutation(api.workspaces.generateLogoUploadUrl)
  const clearLogo = useMutation(api.workspaces.clearLogo)

  const [name, setName] = useState("")
  const [website, setWebsite] = useState("")
  const [email, setEmail] = useState("")
  const [ctaText, setCtaText] = useState("")
  const [ctaUrl, setCtaUrl] = useState("")
  const [accent, setAccent] = useState("#5b5bd6")
  const [lang, setLang] = useState<"de" | "en">("de")
  const [logoStorageId, setLogoStorageId] = useState<string | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<BrandingFieldErrors>({})
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isAccentPreviewing, setIsAccentPreviewing] = useState(false)
  const hydratedVersion = useRef<number | null>(null)

  useEffect(() => {
    if (!data) return
    if (!shouldHydrateBrandingForm(hydratedVersion.current, data.workspace.updatedAt)) return
    hydratedVersion.current = data.workspace.updatedAt
    setName(data.workspace.name)
    setWebsite(data.workspace.website)
    setEmail(data.workspace.contactEmail)
    setCtaText(data.workspace.ctaText)
    setCtaUrl(data.workspace.ctaUrl)
    setAccent(data.workspace.accentColor)
    setLang(data.workspace.reportLanguage)
    setLogoStorageId(data.workspace.logoStorageId)
    setLogoUrl(data.workspace.logoUrl)
    setFieldErrors({})
  }, [data])

  useEffect(() => {
    if (!data || !isAccentPreviewing) return
    applyWorkspaceAccent(document.documentElement.style, accent)

    return () => {
      applyWorkspaceAccent(document.documentElement.style, data.workspace.accentColor)
    }
  }, [accent, data?.workspace.accentColor, isAccentPreviewing])

  const clientErrors = useMemo(() => {
    const parsed = parseBrandingInput({
      name,
      logoStorageId,
      accentColor: accent,
      website,
      contactEmail: email,
      ctaText,
      ctaUrl,
      reportLanguage: lang,
    })
    return parsed.ok ? {} : parsed.fieldErrors
  }, [accent, ctaText, ctaUrl, email, lang, logoStorageId, name, website])

  const visibleErrors = { ...clientErrors, ...fieldErrors }

  function resetForm() {
    if (!data) return
    setIsAccentPreviewing(false)
    setName(data.workspace.name)
    setWebsite(data.workspace.website)
    setEmail(data.workspace.contactEmail)
    setCtaText(data.workspace.ctaText)
    setCtaUrl(data.workspace.ctaUrl)
    setAccent(data.workspace.accentColor)
    setLang(data.workspace.reportLanguage)
    setLogoStorageId(data.workspace.logoStorageId)
    setLogoUrl(data.workspace.logoUrl)
    setFieldErrors({})
  }

  async function handleLogoUpload(file: File | null) {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Bitte lade eine Bilddatei hoch.")
      return
    }

    setIsUploading(true)
    try {
      const uploadUrl = await generateLogoUploadUrl()
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      })
      if (!response.ok) throw new Error("Upload failed")
      const result = (await response.json()) as { storageId: string }
      setLogoStorageId(result.storageId)
      setLogoUrl(URL.createObjectURL(file))
    } catch {
      toast.error("Logo konnte nicht hochgeladen werden")
    } finally {
      setIsUploading(false)
    }
  }

  async function saveBranding() {
    setIsSaving(true)
    setFieldErrors({})
    try {
      await updateBranding({
        name,
        logoStorageId: logoStorageId as Id<"_storage"> | null,
        accentColor: accent,
        website,
        contactEmail: email,
        ctaText,
        ctaUrl,
        reportLanguage: lang,
      })
      toast.success("Branding gespeichert")
    } catch (error) {
      const errors = fieldErrorMessage(error)
      setFieldErrors(errors)
      toast.error("Branding konnte nicht gespeichert werden", {
        description: Object.keys(errors).length > 0 ? "Bitte prüfe die markierten Felder." : undefined,
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function removeLogo() {
    setLogoStorageId(null)
    setLogoUrl(null)
    try {
      await clearLogo()
      toast.success("Logo entfernt")
    } catch {
      toast.error("Logo konnte nicht entfernt werden")
    }
  }

  if (data === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="size-6 text-primary" />
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Report-Branding</CardTitle>
        <CardDescription>
          Name, Farbe und Call-to-Action für gebrandete Reports.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ws-name">Studio-Name</Label>
            <Input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} />
            <FieldError message={visibleErrors.name} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ws-web">Website</Label>
            <Input id="ws-web" value={website} onChange={(e) => setWebsite(e.target.value)} />
            <FieldError message={visibleErrors.website} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Logo</Label>
          <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
            <div className="flex size-12 items-center justify-center overflow-hidden rounded-md bg-muted">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="h-full w-full object-contain" />
              ) : (
                <ImageIcon className="size-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex flex-1 flex-wrap gap-2">
              <Button variant="outline" size="sm" className="gap-2" asChild disabled={isUploading}>
                <label>
                  {isUploading ? <Spinner className="size-4" /> : <Upload className="size-4" />}
                  Logo hochladen
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/*"
                    onChange={(event) => void handleLogoUpload(event.target.files?.[0] ?? null)}
                  />
                </label>
              </Button>
              {logoUrl && (
                <Button variant="outline" size="sm" className="gap-2" onClick={removeLogo}>
                  <X className="size-4" />
                  Entfernen
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <Palette className="size-3.5" />
            Akzentfarbe
          </Label>
          <div className="flex flex-wrap gap-2">
            {accents.map((a) => (
              <button
                type="button"
                key={a.value}
                onClick={() => {
                  setIsAccentPreviewing(true)
                  setAccent(a.value)
                }}
                aria-pressed={accent === a.value}
                style={
                  accent === a.value
                    ? { borderColor: a.value, backgroundColor: `${a.value}14` }
                    : undefined
                }
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                  accent !== a.value && "hover:bg-muted/60",
                )}
              >
                <span className="size-4 rounded-full" style={{ backgroundColor: a.value }}>
                  {accent === a.value && <Check className="size-4 p-0.5 text-white" />}
                </span>
                {a.name}
              </button>
            ))}
          </div>
        </div>

        <Separator />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cta-text">CTA-Text</Label>
            <Input id="cta-text" value={ctaText} onChange={(e) => setCtaText(e.target.value)} />
            <FieldError message={visibleErrors.ctaText} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cta-url">CTA-Link</Label>
            <Input id="cta-url" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} />
            <FieldError message={visibleErrors.ctaUrl} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ws-email">Kontakt-E-Mail</Label>
            <Input id="ws-email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <FieldError message={visibleErrors.contactEmail} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ws-lang">Report-Sprache</Label>
            <Select value={lang} onValueChange={(v) => setLang(v as "de" | "en")}>
              <SelectTrigger id="ws-lang">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="de">Deutsch</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
            <FieldError message={visibleErrors.reportLanguage} />
          </div>
        </div>
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button variant="outline" onClick={resetForm}>
          Zurücksetzen
        </Button>
        <Button onClick={saveBranding} disabled={isSaving}>
          {isSaving && <Spinner className="mr-2 size-4" />}
          Speichern
        </Button>
      </CardFooter>
    </Card>
  )
}

BrandingFormContent.displayName = "BrandingFormContent"
