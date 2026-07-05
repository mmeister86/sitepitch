import type { Metadata } from "next"
import type { ReactNode } from "react"

import { AppProviders } from "@/components/app-providers"
import { getToken } from "@/lib/auth-server"

import "goey-toast/styles.css"
import "../src/index.css"

export const metadata: Metadata = {
  title: "SitePitch",
  description: "Audit- und Lead-Dashboard fuer Agenturen",
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const token = await getToken()

  return (
    <html lang="de" suppressHydrationWarning>
      <body>
        <AppProviders initialToken={token}>{children}</AppProviders>
      </body>
    </html>
  )
}
