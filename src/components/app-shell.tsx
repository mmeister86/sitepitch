"use client"

import { Bell, Search } from "lucide-react"
import type { ReactNode } from "react"

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ModeToggle } from "@/components/mode-toggle"
import { AppSidebar } from "@/components/app-sidebar"
import { useRouter } from "@/lib/router"

function useTitle() {
  const { view } = useRouter()
  switch (view.name) {
    case "dashboard":
      return "Übersicht"
    case "audits":
      return "Audits"
    case "new-audit":
      return "Neuer Audit"
    case "audit":
      return "Audit"
    case "leads":
      return "Leads"
    case "lead-search":
      return "Leads suchen"
    case "campaigns":
      return "Kampagnen"
    case "settings":
      return "Einstellungen"
    case "branding-settings":
      return "Report-Branding"
    case "billing-settings":
      return "Plan & Credits"
  }
}

export function AppShell({ children }: { children: ReactNode }) {
  const title = useTitle()

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur-md md:px-6">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 h-5" />
          <h1 className="text-sm font-semibold tracking-tight">{title}</h1>

          <div className="ml-auto flex items-center gap-2">
            <div className="relative hidden md:block">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Leads, Audits, Domains …"
                className="h-9 w-56 pl-8 lg:w-72"
              />
            </div>
            <Button variant="outline" size="icon" className="relative">
              <Bell className="size-4" />
              <span className="absolute right-2 top-2 size-2 rounded-full bg-primary ring-2 ring-background" />
              <span className="sr-only">Benachrichtigungen</span>
            </Button>
            <ModeToggle />
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
