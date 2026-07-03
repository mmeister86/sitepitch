import type { Metadata } from "next"
import type { ReactNode } from "react"

import { AppShell } from "@/components/app-shell"
import { AppProviders } from "@/components/app-providers"

import "goey-toast/styles.css"
import "../src/index.css"

export const metadata: Metadata = {
  title: "SitePitch",
  description: "Audit- und Lead-Dashboard fuer Agenturen",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body>
        <AppProviders>
          <AppShell>{children}</AppShell>
        </AppProviders>
      </body>
    </html>
  )
}
