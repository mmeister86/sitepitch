"use client"

import { usePathname, useRouter as useNextRouter } from "next/navigation"
import type { ReactNode } from "react"

export type View =
  | { name: "dashboard" }
  | { name: "activity" }
  | { name: "audits" }
  | { name: "batch-audits" }
  | { name: "new-batch-audit" }
  | { name: "batch-audit"; id: string }
  | { name: "new-audit" }
  | { name: "audit"; id: string }
  | { name: "leads" }
  | { name: "lead-search" }
  | { name: "campaigns" }
  | { name: "campaign"; id: string }
  | { name: "settings" }
  | { name: "branding-settings" }
  | { name: "billing-settings" }

function parsePath(pathname: string): View {
  const parts = pathname.split("/").filter(Boolean)
  if (parts[0] === "app") parts.shift()
  if (parts[0] === "audits" && parts[1] === "batches" && parts[2] === "new") {
    return { name: "new-batch-audit" }
  }
  if (parts[0] === "audits" && parts[1] === "batches" && parts[2]) {
    return { name: "batch-audit", id: decodeURIComponent(parts[2]) }
  }
  if (parts[0] === "audits" && parts[1] === "batches") {
    return { name: "batch-audits" }
  }
  if (parts[0] === "audits" && parts[1] === "new") {
    return { name: "new-audit" }
  }
  if (parts[0] === "audits" && parts[1]) {
    return { name: "audit", id: decodeURIComponent(parts[1]) }
  }
  if (parts[0] === "audits") return { name: "audits" }
  if (parts[0] === "activity") return { name: "activity" }
  if (parts[0] === "leads" && parts[1] === "search") {
    return { name: "lead-search" }
  }
  if (parts[0] === "leads") return { name: "leads" }
  if (parts[0] === "campaigns" && parts[1]) return { name: "campaign", id: decodeURIComponent(parts[1]) }
  if (parts[0] === "campaigns") return { name: "campaigns" }
  if (parts[0] === "settings" && parts[1] === "branding") return { name: "branding-settings" }
  if (parts[0] === "settings" && parts[1] === "billing") return { name: "billing-settings" }
  if (parts[0] === "settings") return { name: "settings" }
  return { name: "dashboard" }
}

function viewToPath(view: View): string {
  switch (view.name) {
    case "dashboard":
      return "/app"
    case "new-audit":
      return "/app/audits/new"
    case "batch-audits":
      return "/app/audits/batches"
    case "new-batch-audit":
      return "/app/audits/batches/new"
    case "batch-audit":
      return `/app/audits/batches/${encodeURIComponent(view.id)}`
    case "audit":
      return `/app/audits/${encodeURIComponent(view.id)}`
    case "lead-search":
      return "/app/leads/search"
    case "campaign":
      return `/app/campaigns/${encodeURIComponent(view.id)}`
    case "branding-settings":
      return "/app/settings/branding"
    case "billing-settings":
      return "/app/settings/billing"
    default:
      return `/app/${view.name}`
  }
}

interface RouterContextValue {
  view: View
  navigate: (view: View) => void
}

export function RouterProvider({ children }: { children: ReactNode }) {
  return children
}

export function useRouter(): RouterContextValue {
  const pathname = usePathname()
  const router = useNextRouter()
  const view = parsePath(pathname ?? "/")

  return {
    view,
    navigate: (next: View) => {
      router.push(viewToPath(next))
    },
  }
}
