import type { ReactNode } from "react"

import { PublicFooter } from "./public-footer"
import { PublicHeader } from "./public-header"

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <PublicHeader />
      <main>{children}</main>
      <PublicFooter />
    </div>
  )
}
