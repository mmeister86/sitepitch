"use client"

import {
  ChevronUp,
  LogOut,
  Mail,
  LayoutDashboard,
  ScanSearch,
  Users,
  Megaphone,
  Settings,
  Plus,
  Sparkles,
} from "lucide-react"
import { useQuery } from "convex/react"
import { useRouter as useNextRouter } from "next/navigation"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Logo } from "@/components/logo"
import { NewAuditDialog } from "@/components/new-audit-dialog"
import { useRouter, type View } from "@/lib/router"
import { audits, leads, campaigns } from "@/lib/mock-data"
import { authClient } from "@/lib/auth-client"
import { api } from "../../convex/_generated/api"

const nav: {
  label: string
  view: View
  icon: typeof LayoutDashboard
  badge?: number
}[] = [
  { label: "Dashboard", view: { name: "dashboard" }, icon: LayoutDashboard },
  { label: "Audits", view: { name: "audits" }, icon: ScanSearch, badge: audits.length },
  { label: "Leads", view: { name: "leads" }, icon: Users, badge: leads.length },
  { label: "Kampagnen", view: { name: "campaigns" }, icon: Megaphone, badge: campaigns.length },
]

export function AppSidebar() {
  const { view, navigate } = useRouter()
  const nextRouter = useNextRouter()
  const data = useQuery(api.workspaces.getMyWorkspace)
  const session = authClient.useSession()
  const monthlyCredits = data?.credits.total ?? 0
  const remaining = data?.credits.remaining ?? 0
  const pct = monthlyCredits > 0 ? ((monthlyCredits - remaining) / monthlyCredits) * 100 : 0
  const displayName = data?.user.name ?? session.data?.user?.name ?? "Workspace-Inhaber"
  const email = data?.user.email ?? session.data?.user?.email ?? ""
  const workspaceName = data?.workspace.name ?? "SitePitch Workspace"
  const initials = (displayName || email || "SP").slice(0, 2).toUpperCase()

  const isActive = (v: View) =>
    v.name === view.name ||
    (v.name === "audits" && view.name === "audit")

  async function signOut() {
    await authClient.signOut()
    nextRouter.replace("/login")
  }

  return (
    <Sidebar>
      <SidebarHeader className="p-3">
        <div className="px-1 py-1.5">
          <Logo />
        </div>
        <NewAuditDialog
          trigger={
            <Button className="mt-1 w-full justify-start gap-2 bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90">
              <Plus className="size-4" />
              Neuer Audit
            </Button>
          }
        />
      </SidebarHeader>

      <SidebarContent className="px-1">
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((item) => (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton
                    isActive={isActive(item.view)}
                    onClick={() => navigate(item.view)}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                    {item.badge !== undefined && (
                      <span className="ml-auto rounded-md bg-sidebar-accent px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-sidebar-foreground/60">
                        {item.badge}
                      </span>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-3 p-3">
        <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/50 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-sidebar-foreground/70">Credits</span>
            <span className="font-semibold tabular-nums text-sidebar-foreground">
              {remaining} / {monthlyCredits}
            </span>
          </div>
          <Progress value={pct} className="mt-2 h-1.5 bg-sidebar-border" />
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-sidebar-foreground/50">
            <Sparkles className="size-3" />
            Free-Plan · MVP
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
                {initials}
              </div>
              <div className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate text-xs font-medium text-sidebar-foreground">
                  {displayName}
                </span>
                <span className="truncate text-[11px] text-sidebar-foreground/50">
                  {workspaceName}
                </span>
              </div>
              <ChevronUp className="size-3.5 shrink-0 text-sidebar-foreground/45" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="start"
            sideOffset={8}
            className="w-64 p-2"
          >
            <DropdownMenuLabel className="px-2 py-2">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {initials}
                </div>
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-sm font-medium">
                    {displayName}
                  </p>
                  <p className="truncate text-xs font-normal text-muted-foreground">
                    {email}
                  </p>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate({ name: "settings" })}>
              <Settings />
              Branding & Team
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate({ name: "campaigns" })}>
              <Mail />
              Vorlagen & Outreach
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void signOut()}>
              <LogOut />
              Abmelden
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
