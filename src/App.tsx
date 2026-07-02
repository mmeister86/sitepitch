import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { RouterProvider, useRouter } from "@/lib/router"
import { AppShell } from "@/components/app-shell"
import { DashboardView } from "@/views/dashboard"
import { AuditsView } from "@/views/audits"
import { AuditDetailView } from "@/views/audit-detail"
import { LeadsView } from "@/views/leads"
import { CampaignsView } from "@/views/campaigns"
import { SettingsView } from "@/views/settings"

function CurrentView() {
  const { view } = useRouter()
  switch (view.name) {
    case "dashboard":
      return <DashboardView />
    case "audits":
      return <AuditsView />
    case "audit":
      return <AuditDetailView id={view.id} />
    case "leads":
      return <LeadsView />
    case "campaigns":
      return <CampaignsView />
    case "settings":
      return <SettingsView />
  }
}

export function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="sitepitch-theme">
      <RouterProvider>
        <AppShell>
          <CurrentView />
        </AppShell>
      </RouterProvider>
      <Toaster />
    </ThemeProvider>
  )
}

export default App
