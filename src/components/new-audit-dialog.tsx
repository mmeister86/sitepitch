import { useState } from "react"
import type { ReactNode } from "react"
import { toast } from "sonner"
import { Globe, Sparkles, Loader2 } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
import { workspace } from "@/lib/mock-data"

export function NewAuditDialog({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState("")
  const [type, setType] = useState("standard")
  const [lang, setLang] = useState<"de" | "en">("de")
  const [loading, setLoading] = useState(false)

  const remaining = workspace.monthlyCredits - workspace.usedCredits

  const start = () => {
    if (!url.trim()) {
      toast.error("Bitte eine Website-URL eingeben.")
      return
    }
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      setOpen(false)
      setUrl("")
      toast.success("Audit gestartet", {
        description: `${url.replace(/^https?:\/\//, "")} · 1 Credit reserviert`,
      })
    }, 900)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Neuen Audit starten</DialogTitle>
          <DialogDescription>
            Analysiere eine öffentlich erreichbare Website und erstelle einen
            gebrandeten Report.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label htmlFor="audit-url">Website-URL</Label>
            <div className="relative">
              <Globe className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="audit-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="zahnarzt-mueller.de"
                className="pl-9"
                onKeyDown={(e) => e.key === "Enter" && start()}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Audit-Typ</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="local">Local SEO</SelectItem>
                  <SelectItem value="quick">Quick</SelectItem>
                </SelectContent>
              </Select>
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

          <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2.5 text-xs text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" />
            Dieser Audit verbraucht <span className="font-medium text-foreground">1 Credit</span>.
            Noch {remaining} verfügbar.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Abbrechen
          </Button>
          <Button onClick={start} disabled={loading} className="gap-2">
            {loading && <Loader2 className="size-4 animate-spin" />}
            {loading ? "Wird gestartet …" : "Audit starten"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
