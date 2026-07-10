"use client"

import { useState } from "react"
import { useMutation } from "convex/react"
import { Pencil, Loader2, Check } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "@/components/ui/sonner"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"

type EditableLeadFields = {
  leadId: Id<"leads">
  businessName: string
  category?: string
  city?: string
  country?: string
  address?: string
  phone?: string
  businessEmail?: string
}

export type LeadEditDialogProps = {
  lead: EditableLeadFields | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LeadEditDialog({ lead, open, onOpenChange }: LeadEditDialogProps) {
  const updateLeadProfile = useMutation(api.leads.updateLeadProfile)

  const [businessName, setBusinessName] = useState("")
  const [category, setCategory] = useState("")
  const [city, setCity] = useState("")
  const [country, setCountry] = useState("")
  const [address, setAddress] = useState("")
  const [phone, setPhone] = useState("")
  const [businessEmail, setBusinessEmail] = useState("")
  const [emailError, setEmailError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  function resetForm(target: EditableLeadFields) {
    setBusinessName(target.businessName)
    setCategory(target.category ?? "")
    setCity(target.city ?? "")
    setCountry(target.country ?? "")
    setAddress(target.address ?? "")
    setPhone(target.phone ?? "")
    setBusinessEmail(target.businessEmail ?? "")
    setEmailError(null)
  }

  if (lead && open && businessName !== lead.businessName) {
    resetForm(lead)
  }

  async function handleSubmit() {
    if (!lead) return
    if (isSaving) return

    const email = businessEmail.trim()
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Bitte gib eine gültige E-Mail-Adresse ein.")
      return
    }
    setEmailError(null)

    setIsSaving(true)
    try {
      await updateLeadProfile({
        leadId: lead.leadId,
        businessName: businessName.trim(),
        category: category.trim() || undefined,
        city: city.trim() || undefined,
        country: country.trim() || undefined,
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
        businessEmail: email || undefined,
      })
      toast.success("Lead-Daten aktualisiert")
      onOpenChange(false)
    } catch (error) {
      toast.error((error as Error)?.message ?? "Lead-Daten konnten nicht gespeichert werden")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Lead bearbeiten</DialogTitle>
          <DialogDescription>
            Name, Kategorie und Kontaktdaten anpassen. Die Website bleibt unverändert.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="lead-edit-name">Unternehmensname</Label>
            <Input
              id="lead-edit-name"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Zahnarzt Buchhardt"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="lead-edit-category">Kategorie</Label>
              <Input
                id="lead-edit-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Zahnarzt"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-edit-city">Stadt</Label>
              <Input
                id="lead-edit-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Crimmitschau"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="lead-edit-country">Land</Label>
              <Input
                id="lead-edit-country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="Deutschland"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-edit-phone">Telefon</Label>
              <Input
                id="lead-edit-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+49 3762 5175"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lead-edit-address">Adresse</Label>
            <Input
              id="lead-edit-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Anton-Günther-Platz 1, 08451 Crimmitschau"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lead-edit-email">E-Mail</Label>
            <Input
              id="lead-edit-email"
              type="email"
              value={businessEmail}
              onChange={(e) => {
                setBusinessEmail(e.target.value)
                if (emailError) setEmailError(null)
              }}
              placeholder="praxis@example.de"
              className={emailError ? "border-destructive focus-visible:ring-destructive/30" : ""}
            />
            {emailError && <p className="text-xs font-medium text-destructive">{emailError}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Abbrechen
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={isSaving || !businessName.trim()}>
            {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function LeadEditButton({
  lead,
  onClick,
}: {
  lead: EditableLeadFields
  onClick: () => void
}) {
  return (
    <Button variant="outline" size="sm" className="gap-1.5" onClick={onClick}>
      <Pencil className="size-3.5" />
      Bearbeiten
    </Button>
  )
}
