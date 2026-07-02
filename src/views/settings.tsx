import { useState } from "react"
import { toast } from "sonner"
import { Palette, Check, Mail, UserPlus, Sparkles, FileText, Plus, MessageSquare, Phone } from "lucide-react"

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
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { workspace } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

const accents = [
  { name: "Indigo", value: "#5b5bd6" },
  { name: "Violett", value: "#7c3aed" },
  { name: "Blau", value: "#2563eb" },
  { name: "Smaragd", value: "#059669" },
  { name: "Bernstein", value: "#d97706" },
  { name: "Rosé", value: "#e11d48" },
]

const roleLabel: Record<string, string> = {
  owner: "Inhaber",
  member: "Mitglied",
  viewer: "Betrachter",
}

const channelMeta: Record<string, { label: string; icon: typeof Mail }> = {
  email: { label: "E-Mail", icon: Mail },
  linkedin: { label: "LinkedIn", icon: MessageSquare },
  phone_note: { label: "Telefonnotiz", icon: Phone },
}

export function SettingsView() {
  const [name, setName] = useState(workspace.name)
  const [website, setWebsite] = useState(workspace.website)
  const [email, setEmail] = useState(workspace.contactEmail)
  const [ctaText, setCtaText] = useState(workspace.ctaText)
  const [ctaUrl, setCtaUrl] = useState(workspace.ctaUrl)
  const [accent, setAccent] = useState(workspace.accentColor)
  const [lang, setLang] = useState<"de" | "en">(workspace.language)
  const [poweredBy, setPoweredBy] = useState(workspace.showPoweredBy)

  const remaining = workspace.monthlyCredits - workspace.usedCredits
  const pct = (workspace.usedCredits / workspace.monthlyCredits) * 100

  return (
    <div className="mx-auto w-full max-w-[900px] space-y-6 p-4 md:p-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Branding & Team</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Diese Angaben erscheinen auf jedem geteilten Report.
        </p>
      </div>

      {/* Branding */}
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="ws-web">Website</Label>
              <Input id="ws-web" value={website} onChange={(e) => setWebsite(e.target.value)} />
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
                  key={a.value}
                  onClick={() => setAccent(a.value)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                    accent === a.value ? "border-foreground/30 bg-muted" : "hover:bg-muted/60"
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="cta-url">CTA-Link</Label>
              <Input id="cta-url" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ws-email">Kontakt-E-Mail</Label>
              <Input id="ws-email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Report-Sprache</Label>
              <Select value={lang} onValueChange={(v) => setLang(v as "de" | "en")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="de">Deutsch</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label className="text-sm">»Powered by SitePitch« anzeigen</Label>
              <p className="text-xs text-muted-foreground">
                Im Agency-Plan optional abschaltbar.
              </p>
            </div>
            <Switch checked={poweredBy} onCheckedChange={setPoweredBy} />
          </div>
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button variant="outline" onClick={() => toast("Änderungen verworfen")}>
            Zurücksetzen
          </Button>
          <Button onClick={() => toast.success("Branding gespeichert")}>Speichern</Button>
        </CardFooter>
      </Card>

      {/* Templates */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              Outreach-Templates
            </CardTitle>
            <CardDescription>
              Wiederverwendbare Textbausteine für schnellere Ansprache.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => toast.success("Template erstellt")}
          >
            <Plus className="size-4" />
            Neu
          </Button>
        </CardHeader>
        <CardContent className="p-2">
          <div className="divide-y">
            {workspace.templates.map((t) => {
              const meta = channelMeta[t.channel]
              const Icon = meta.icon
              return (
                <button
                  key={t.id}
                  onClick={() => toast(`Template »${t.name}«`, { description: "Bearbeiten folgt im Post-MVP." })}
                  className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/60"
                >
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{t.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {meta.label} · {t.usageCount}× genutzt
                    </div>
                  </div>
                  <Badge variant="secondary" className="font-normal">
                    {t.tone}
                  </Badge>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Plan */}
      <Card>
        <CardHeader>
          <CardTitle>Plan & Credits</CardTitle>
          <CardDescription>Dein aktuelles Guthaben für diesen Monat.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge className="gap-1.5 border-0 bg-primary/12 font-medium text-primary">
              <Sparkles className="size-3" />
              Agency-Plan
            </Badge>
            <span className="text-sm text-muted-foreground">
              {workspace.seats.length} Sitzplätze
            </span>
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Credits verbraucht</span>
              <span className="font-medium tabular-nums">
                {workspace.usedCredits} / {workspace.monthlyCredits} · {remaining} übrig
              </span>
            </div>
            <Progress value={pct} className="h-2" />
          </div>
        </CardContent>
        <CardFooter>
          <Button
            variant="outline"
            onClick={() => toast.info("Upgrade", { description: "Plan-Verwaltung folgt im Post-MVP." })}
          >
            Plan verwalten
          </Button>
        </CardFooter>
      </Card>

      {/* Team */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Team</CardTitle>
            <CardDescription>{workspace.seats.length} Mitglieder</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => toast.success("Einladung versendet")}
          >
            <UserPlus className="size-4" />
            Einladen
          </Button>
        </CardHeader>
        <CardContent className="p-2">
          <div className="divide-y">
            {workspace.seats.map((s) => (
              <div key={s.email} className="flex items-center gap-3 px-3 py-3">
                <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {s.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{s.name}</div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Mail className="size-3" />
                    {s.email}
                  </div>
                </div>
                <Badge variant="secondary" className="font-normal capitalize">
                  {roleLabel[s.role] ?? s.role}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
