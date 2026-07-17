import Image from "next/image"
import Link from "next/link"

import { Logo } from "@/components/logo"
import { footerNavigation } from "@/lib/launch-content"

export function PublicFooter() {
  return (
    <footer data-registry-block="footer11" className="border-t bg-muted/25">
      <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
        <div className="flex flex-col items-start justify-between gap-10 md:flex-row">
          <div className="w-full space-y-4 md:max-w-sm">
            <Link href="/" aria-label="SitePitch Startseite" className="inline-flex">
              <Logo />
            </Link>
            <p className="max-w-sm text-sm leading-6 text-muted-foreground">
              Konkrete Website-Audits für bessere, respektvolle Kundengespräche.
            </p>
          </div>
          <div data-footer-region="link-grid" className="grid w-full grid-cols-2 gap-8 sm:grid-cols-3 md:w-auto md:gap-12 lg:gap-16">
            {footerNavigation.map((group) => (
              <div key={group.title} className="min-w-32 space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground">{group.title}</h2>
                <ul className="grid gap-2 text-sm">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="underline-offset-4 hover:text-primary hover:underline">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 overflow-hidden rounded-xl border bg-background p-2 md:mt-16">
          <Image
            src="/audit-restaurant-desktop.webp"
            width={1440}
            height={900}
            alt="SitePitch Beispielreport mit Kategorie-Scores und konkreten Empfehlungen"
            className="max-h-[440px] w-full rounded-lg border object-cover object-top"
          />
        </div>

        <div className="mt-8 border-t pt-5">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} SitePitch. Keine automatische Massenversendung und keine Erfolgsversprechen.
          </p>
        </div>
      </div>
    </footer>
  )
}
