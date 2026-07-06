import type { ReactNode } from "react"

import { AppShell } from "@/components/app-shell"
import { ProtectedApp } from "@/components/protected-app"

export default function ProductLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedApp>
      <AppShell>{children}</AppShell>
    </ProtectedApp>
  )
}
