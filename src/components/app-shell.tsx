"use client"

import { Bell, Search } from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"
import { useMutation, useQuery } from "convex/react"

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ModeToggle } from "@/components/mode-toggle"
import { AppSidebar } from "@/components/app-sidebar"
import { useRouter } from "@/lib/router"
import { api } from "../../convex/_generated/api"

function relativeTime(timestamp: number, now: number): string {
  const seconds = Math.round((timestamp - now) / 1_000)
  const formatter = new Intl.RelativeTimeFormat("de", { numeric: "auto" })
  if (Math.abs(seconds) < 60) return formatter.format(seconds, "second")
  const minutes = Math.round(seconds / 60)
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute")
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour")
  return formatter.format(Math.round(hours / 24), "day")
}

function NotificationPopover() {
  const [open, setOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const notifications = useQuery(api.notifications.list)
  const unreadCount = useQuery(api.notifications.unreadCount)
  const markRead = useMutation(api.notifications.markRead)
  const markAllRead = useMutation(api.notifications.markAllRead)
  const { navigate } = useRouter()
  const isLoading = notifications === undefined || unreadCount === undefined
  const unreadTotal = unreadCount?.count ?? 0

  useEffect(() => {
    if (!open) return
    setNow(Date.now())
    const interval = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(interval)
  }, [open])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Bell className="size-4" />
          {!isLoading && unreadTotal > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-5 text-primary-foreground ring-2 ring-background">
              {unreadTotal > 99 ? "99+" : unreadTotal}
            </span>
          )}
          <span className="sr-only">Benachrichtigungen</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Benachrichtigungen</h2>
            <p className="text-xs text-muted-foreground">
              {isLoading
                ? "Wird geladen …"
                : unreadTotal > 0
                  ? `${unreadTotal}${unreadCount.capped ? "+" : ""} ungelesen`
                  : "Alles gelesen"}
            </p>
          </div>
          {!isLoading && unreadTotal > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => markAllRead({}).catch(() => {})}
            >
              Alle gelesen
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3 p-4" aria-label="Benachrichtigungen werden geladen">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-12 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <Bell className="mx-auto size-6 text-muted-foreground/60" />
            <p className="mt-2 text-sm font-medium">Noch keine Aktivität</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Report-Aufrufe erscheinen hier.
            </p>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto py-1">
            {notifications.map((notification) => {
              const unread = notification.readAt === null
              const label = notification.type === "first_open"
                ? "Report erstmals geöffnet"
                : "Report erneut geöffnet"
              return (
                <button
                  key={notification._id}
                  type="button"
                  className="flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/70"
                  onClick={() => {
                    if (unread) markRead({ notificationId: notification._id }).catch(() => {})
                    navigate({ name: "audit", id: notification.auditId })
                  }}
                >
                  <span className="relative mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Bell className="size-3.5" />
                    {unread && <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-primary ring-2 ring-background" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={unread ? "block text-sm font-semibold" : "block text-sm font-medium"}>
                      {label}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {notification.domain ?? "Audit-Report"} · {relativeTime(notification.createdAt, now)}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

function useTitle() {
  const { view } = useRouter()
  switch (view.name) {
    case "dashboard":
      return "Übersicht"
    case "activity":
      return "Aktivität"
    case "audits":
      return "Audits"
    case "batch-audits":
      return "Batch-Audits"
    case "new-batch-audit":
      return "Batch vorbereiten"
    case "batch-audit":
      return "Batch-Audit"
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
    case "integration-settings":
      return "Integrationen"
    case "api-settings":
      return "Public API"
    case "admin-operations":
      return "Operations"
    case "admin-evals":
      return "Eve Evals"
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
            <NotificationPopover />
            <ModeToggle />
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
