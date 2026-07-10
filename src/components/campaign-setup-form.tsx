"use client"

import { useState } from "react"
import { useMutation } from "convex/react"
import { useRouter } from "@/lib/router"
import { Megaphone } from "lucide-react"

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

export type CampaignSetupFormProps = {
  onCreated?: (campaignId: string) => void
}

export function CampaignSetupForm({ onCreated }: CampaignSetupFormProps) {
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
      if (onCreated) {
        onCreated(result.campaignId)
      } else {
        navigate({ name: "campaign", id: result.campaignId })
      }
      setName("")
      setIndustry("")
      setCity("")
      setCountry("Deutschland")
      setOfferType("relaunch")
      setLanguage("de")
    } catch (error) {
      toast.error((error as Error)?.message ?? "Kampagne konnte nicht erstellt werden")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="gap-3 border-b py-4">
        <div className="flex items-center gap-2">
          <Megaphone className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Kampagnen-Setup</h3>
        </div>
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
  )
}
