"use client"

import { usePathname, useRouter as useNextRouter } from "next/navigation"
import type { ReactNode } from "react"

export type View =
  | { name: "dashboard" }
  | { name: "audits" }
  | { name: "audit"; id: string }
  | { name: "leads" }
  | { name: "campaigns" }
  | { name: "newCampaign" }
  | { name: "campaign"; id: string }
  | { name: "settings" }

function parsePath(pathname: string): View {
  const parts = pathname.split("/").filter(Boolean)
  if (parts[0] === "app") parts.shift()
  if (parts[0] === "audits" && parts[1]) {
    return { name: "audit", id: decodeURIComponent(parts[1]) }
  }
  if (parts[0] === "audits") return { name: "audits" }
  if (parts[0] === "leads") return { name: "leads" }
  if (parts[0] === "campaigns" && parts[1] === "new") return { name: "newCampaign" }
  if (parts[0] === "campaigns" && parts[1]) return { name: "campaign", id: decodeURIComponent(parts[1]) }
  if (parts[0] === "campaigns") return { name: "campaigns" }
  if (parts[0] === "settings") return { name: "settings" }
  return { name: "dashboard" }
}

function viewToPath(view: View): string {
  switch (view.name) {
    case "dashboard":
      return "/app"
    case "audit":
      return `/app/audits/${encodeURIComponent(view.id)}`
    case "newCampaign":
      return "/app/campaigns/new"
    case "campaign":
      return `/app/campaigns/${encodeURIComponent(view.id)}`
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
