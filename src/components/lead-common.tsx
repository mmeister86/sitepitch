"use client"

import type { ReactNode } from "react"
import { Building2, Globe, Mail, MapPin, Megaphone, Phone, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LeadMap } from "@/components/lead-map"
import { cn } from "@/lib/utils"

export type LeadStatus = "new" | "audited" | "contacted" | "follow_up" | "interested" | "won" | "lost"

export type LeadCampaignBadge = {
  campaignId: string
  name: string
  status?: string
}

export type LeadLike = {
  businessName: string
  websiteUrl?: string
  normalizedWebsiteUrl?: string
  category?: string
  city?: string
  country?: string
  address?: string
  phone?: string
  businessEmail?: string
  latitude?: number
  longitude?: number
  sourceProvider?: string
  auditReady: boolean
  audited?: boolean
  campaigns?: LeadCampaignBadge[]
}

export type SearchResultItem = {
  businessName: string
  websiteUrl?: string
  normalizedWebsiteUrl?: string
  category?: string
  address?: string
  phone?: string
  businessEmail?: string
  city?: string
  country?: string
  latitude?: number
  longitude?: number
  sourceProvider: string
  sourceId?: string
  sourceLabel: string
  auditReady: boolean
}

export type SearchResponse = {
  items: SearchResultItem[]
  provider: string
  sourceLabel: string
  searchedAt: number
  query: string
}

export function sourceLabel(provider: string): string {
  if (provider === "rapidapi") return "Local Business Data"
  if (provider === "google_places") return "Google Places"
  return provider
}

export function LeadStatusBadge({ lead }: { lead: LeadLike }) {
  if (!lead.auditReady) {
    return (
      <Badge variant="outline" className="text-xs text-muted-foreground">
        Website fehlt
      </Badge>
    )
  }
  return (
    <Badge
      variant="outline"
      className={cn("gap-1 text-xs", lead.audited ? "text-score-strong" : "text-muted-foreground")}
    >
      <Globe className="size-3" />
      {lead.audited ? "Auditiert" : "Audit-ready"}
    </Badge>
  )
}

export function LeadCampaignBadges({ campaigns, onNavigate }: { campaigns?: LeadCampaignBadge[]; onNavigate?: (campaignId: string) => void }) {
  if (!campaigns || campaigns.length === 0) return null

  const first = campaigns[0]
  const remaining = campaigns.length - 1

  return (
    <div className="flex items-center gap-1.5">
      <Badge
        variant="outline"
        className="gap-1 text-xs border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 cursor-pointer"
        onClick={(e) => {
          e.stopPropagation()
          onNavigate?.(first.campaignId)
        }}
      >
        <Megaphone className="size-3" />
        {first.name}
      </Badge>
      {remaining > 0 && (
        <span className="text-xs text-muted-foreground" title={campaigns.slice(1).map((c) => c.name).join(", ")}>
          +{remaining}
        </span>
      )}
    </div>
  )
}

export function LeadSummary({ lead, onCampaignNavigate }: { lead: LeadLike; onCampaignNavigate?: (campaignId: string) => void }) {
  return (
    <div className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-1">
      <div className="min-w-0">
        <span className="font-medium">{lead.businessName}</span>
        {lead.category && (
          <span className="ml-2 text-xs text-muted-foreground">{lead.category}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <LeadCampaignBadges campaigns={lead.campaigns} onNavigate={onCampaignNavigate} />
        <LeadStatusBadge lead={lead} />
        {lead.city && (
          <span className="hidden text-xs text-muted-foreground sm:inline">{lead.city}</span>
        )}
        {lead.phone && <Phone className="size-3 text-muted-foreground" />}
        {lead.businessEmail && <Mail className="size-3 text-muted-foreground" />}
      </div>
    </div>
  )
}

export function DetailRow({
  icon,
  label,
  value,
  href,
}: {
  icon: ReactNode
  label: string
  value?: string | null
  href?: string
}) {
  return (
    <div className="grid gap-0.5 rounded-lg border bg-muted/20 px-3 py-2 sm:grid-cols-[110px_1fr] sm:gap-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      {value ? (
        href ? (
          <a
            href={href}
            target={href.startsWith("http") ? "_blank" : undefined}
            rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
            className="break-all text-sm font-medium text-foreground hover:underline"
          >
            {value}
          </a>
        ) : (
          <p className="break-words text-sm font-medium">{value}</p>
        )
      ) : (
        <p className="text-sm text-muted-foreground/40">Nicht gespeichert</p>
      )}
    </div>
  )
}

export function LeadDetailPanel({
  lead,
  onCampaignNavigate,
  action,
}: {
  lead: LeadLike
  onCampaignNavigate?: (campaignId: string) => void
  action?: ReactNode
}) {
  const address =
    lead.address || [lead.city, lead.country].filter(Boolean).join(", ") || undefined

  return (
    <div className="grid gap-4 pt-2 md:grid-cols-[1fr_300px]">
      <div className="space-y-2">
        {lead.campaigns && lead.campaigns.length > 0 && (
          <DetailRow
            icon={<Megaphone className="size-3.5" />}
            label="Kampagnen"
            value={lead.campaigns.map((c) => c.name).join(", ")}
          />
        )}
        <DetailRow
          icon={<Globe className="size-3.5" />}
          label="Website"
          value={lead.normalizedWebsiteUrl ?? lead.websiteUrl}
          href={lead.normalizedWebsiteUrl ?? lead.websiteUrl}
        />
        <DetailRow
          icon={<Mail className="size-3.5" />}
          label="E-Mail"
          value={lead.businessEmail}
          href={lead.businessEmail ? `mailto:${lead.businessEmail}` : undefined}
        />
        <DetailRow
          icon={<Phone className="size-3.5" />}
          label="Telefon"
          value={lead.phone}
          href={lead.phone ? `tel:${lead.phone}` : undefined}
        />
        <DetailRow
          icon={<MapPin className="size-3.5" />}
          label="Adresse"
          value={address}
        />

        {lead.sourceProvider && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-muted-foreground">
              Quelle: {sourceLabel(lead.sourceProvider)}
            </span>
          </div>
        )}

        {action && <div className="flex flex-wrap gap-2 pt-2">{action}</div>}
      </div>

      <LeadMap
        latitude={lead.latitude}
        longitude={lead.longitude}
        name={lead.businessName}
        address={address}
      />
    </div>
  )
}

export function LeadSearchResultSaveButton({
  isSaving,
  onClick,
  label = "Speichern",
}: {
  isSaving: boolean
  onClick: () => void
  label?: string
}) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      disabled={isSaving}
      onClick={onClick}
    >
      {isSaving ? (
        <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <Plus className="size-3.5" />
      )}
      {label}
    </button>
  )
}

export function LeadEmptyIcon({ className }: { className?: string }) {
  return <Building2 className={cn("size-5 text-muted-foreground", className)} />
}

export function LeadSearchEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <LeadSearchIcon />
      <p className="text-sm text-muted-foreground">
        Keine Ergebnisse. Versuche es mit einer anderen Branche oder Stadt.
      </p>
    </div>
  )
}

export function LeadSearchIcon() {
  return <Building2 className="size-5 text-muted-foreground" />
}
