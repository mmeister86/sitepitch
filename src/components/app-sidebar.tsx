import {
  LayoutDashboard,
  ScanSearch,
  Users,
  Megaphone,
  Settings,
  Plus,
  Sparkles,
} from "lucide-react"

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
import { Logo } from "@/components/logo"
import { useRouter, type View } from "@/lib/router"
import { workspace, audits, leads, campaigns } from "@/lib/mock-data"

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
  const remaining = workspace.monthlyCredits - workspace.usedCredits
  const pct = (workspace.usedCredits / workspace.monthlyCredits) * 100

  const isActive = (v: View) =>
    v.name === view.name ||
    (v.name === "audits" && view.name === "audit")

  return (
    <Sidebar>
      <SidebarHeader className="p-3">
        <div className="px-1 py-1.5">
          <Logo />
        </div>
        <Button
          className="mt-1 w-full justify-start gap-2 bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90"
          onClick={() => navigate({ name: "audits" })}
        >
          <Plus className="size-4" />
          Neuer Audit
        </Button>
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

        <SidebarGroup>
          <SidebarGroupLabel>Einstellungen</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={view.name === "settings"}
                  onClick={() => navigate({ name: "settings" })}
                >
                  <Settings />
                  <span>Branding & Team</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-3 p-3">
        <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/50 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-sidebar-foreground/70">Credits</span>
            <span className="font-semibold tabular-nums text-sidebar-foreground">
              {remaining} / {workspace.monthlyCredits}
            </span>
          </div>
          <Progress value={pct} className="mt-2 h-1.5 bg-sidebar-border" />
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-sidebar-foreground/50">
            <Sparkles className="size-3" />
            Agency-Plan · monatlich
          </div>
        </div>

        <div className="flex items-center gap-2.5 px-1">
          <div className="flex size-8 items-center justify-center rounded-full bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
            {workspace.seats[0].initials}
          </div>
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-xs font-medium text-sidebar-foreground">
              {workspace.seats[0].name}
            </span>
            <span className="truncate text-[11px] text-sidebar-foreground/50">
              {workspace.name}
            </span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
