"use client"

import { useState } from "react"
import { useMutation } from "convex/react"
import { ArrowLeft, Megaphone } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { useRouter } from "@/lib/router"
import { toast } from "@/components/ui/sonner"
import { api } from "../../convex/_generated/api"
import type { CampaignOfferType } from "../../convex/lib/campaigns"

const offerOptions: { value: CampaignOfferType; label: string }[] = [
  { value: "relaunch", label: "Website-Relaunch" },
  { value: "maintenance", label: "Website-Pflege" },
  { value: "seo", label: "SEO-Optimierung" },
  { value: "conversion", label: "Conversion-Optimierung" },
  { value: "performance", label: "Performance-Optimierung" },
  { value: "custom", label: "Individuelles Angebot" },
]

export function CampaignNewView() {
  const { navigate } = useRouter()
  const createCampaign = useMutation(api.campaigns.create)

  const [name, setName] = useState("")
  const [industry, setIndustry] = useState("")
  const [city, setCity] = useState("")
  const [country, setCountry] = useState("Deutschland")
  const [offerType, setOfferType] = useState<CampaignOfferType>("relaunch")
  const [language, setLanguage] = useState<"de" | "en">("de")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const suggestedName = industry.trim() || city.trim()
    ? `${industry.trim()} ${city.trim()}`.trim()
    : ""

  async function handleSubmit(status: "draft" | "active") {
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      const result = await createCampaign({
        name: name.trim() || suggestedName || "Neue Kampagne",
        targetIndustry: industry.trim(),
        targetCity: city.trim(),
        targetCountry: country.trim(),
        offerType,
        language,
        status,
      })
      toast.success(status === "active" ? "Kampagne gestartet" : "Entwurf gespeichert")
      navigate({ name: "campaign", id: result.campaignId })
    } catch (error) {
      toast.error("Kampagne konnte nicht erstellt werden")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[700px] space-y-5 p-4 md:p-6">
      <button
        onClick={() => navigate({ name: "campaigns" })}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Zurück zu Kampagnen
      </button>

      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-full bg-muted">
          <Megaphone className="size-5 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Neue Kampagne</h2>
          <p className="text-sm text-muted-foreground">
            Zielgruppe, Angebot und Sprache festlegen
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="border-b py-4">
          <h3 className="text-sm font-semibold">Kampagnen-Setup</h3>
        </CardHeader>
        <CardContent className="space-y-5 py-5">
          <div className="space-y-1.5">
            <Label htmlFor="campaign-name">Kampagnenname</Label>
            <Input
              id="campaign-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={suggestedName || "Zahnärzte Leipzig"}
            />
            <p className="text-xs text-muted-foreground">
              Vorschlag: {suggestedName || "Zahnärzte Leipzig"}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="campaign-industry">Branche</Label>
              <Input
                id="campaign-industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="Zahnarzt"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="campaign-city">Stadt</Label>
              <Input
                id="campaign-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Leipzig"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="campaign-country">Land</Label>
              <Input
                id="campaign-country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="Deutschland"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="campaign-language">Sprache</Label>
              <Select value={language} onValueChange={(v) => setLanguage(v as "de" | "en")}>
                <SelectTrigger id="campaign-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="de">Deutsch</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="campaign-offer">Zielangebot</Label>
            <Select value={offerType} onValueChange={(v) => setOfferType(v as CampaignOfferType)}>
              <SelectTrigger id="campaign-offer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {offerOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => void handleSubmit("draft")}
              disabled={isSubmitting}
            >
              Als Entwurf speichern
            </Button>
            <Button
              className="flex-1"
              onClick={() => void handleSubmit("active")}
              disabled={isSubmitting}
            >
              Kampagne starten
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
