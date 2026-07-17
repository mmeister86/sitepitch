"use client"

import Link from "next/link"
import { Menu } from "lucide-react"

import { Logo } from "@/components/logo"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { publicNavigation } from "@/lib/launch-content"

import { TrackedLink } from "./tracked-link"

export function NavbarFeatureGrid({
  region,
  closeOnNavigate = false,
}: {
  region: "desktop-features" | "mobile-features"
  closeOnNavigate?: boolean
}) {
  return (
    <div data-navbar-region={region} className="grid gap-1 p-2 md:grid-cols-2 md:p-3">
      {publicNavigation.features.map((feature) => {
        const key = `${region}-${feature.label}`
        const featureLink = (
          <Link
            key={key}
            href={feature.href}
            className="flex flex-col gap-1 rounded-md p-3 text-sm transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="font-semibold text-foreground">{feature.label}</span>
            <span className="text-sm leading-5 text-muted-foreground">{feature.description}</span>
          </Link>
        )

        return closeOnNavigate ? (
          <SheetClose asChild key={key}>
            {featureLink}
          </SheetClose>
        ) : featureLink
      })}
    </div>
  )
}

export function MobileFeatureAccordion({ defaultOpen = false }: { defaultOpen?: boolean }) {
  return (
    <Accordion
      type="single"
      collapsible
      defaultValue={defaultOpen ? "features" : undefined}
      data-navbar-region="mobile-features"
      className="border-y"
    >
      <AccordionItem value="features" className="border-none">
        <AccordionTrigger className="px-3 py-4 text-base hover:no-underline">Funktionen</AccordionTrigger>
        <AccordionContent>
          <NavbarFeatureGrid region="mobile-features" closeOnNavigate />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

export function PublicHeader() {
  return (
    <header
      data-registry-block="navbar5"
      className="sticky top-0 z-40 border-b bg-background/95 supports-[backdrop-filter]:bg-background/90"
    >
      <nav
        aria-label="Hauptnavigation"
        className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8"
      >
        <Link href="/" aria-label="SitePitch Startseite" className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Logo />
        </Link>

        <NavigationMenu className="hidden lg:flex">
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuTrigger>Funktionen</NavigationMenuTrigger>
              <NavigationMenuContent>
                <div className="w-[640px]">
                  <NavbarFeatureGrid region="desktop-features" />
                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>
            {publicNavigation.links.slice(1).map((link) => (
              <NavigationMenuItem key={link.href}>
                <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
                  <Link href={link.href}>{link.label}</Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
            ))}
          </NavigationMenuList>
        </NavigationMenu>

        <div className="hidden items-center gap-2 lg:flex">
          <Button variant="ghost" asChild>
            <Link href={publicNavigation.login.href}>{publicNavigation.login.label}</Link>
          </Button>
          <Button asChild>
            <TrackedLink
              href={publicNavigation.primaryCta.href}
              eventName="marketing_cta_clicked"
              eventSource="navbar"
            >
              {publicNavigation.primaryCta.label}
            </TrackedLink>
          </Button>
        </div>

        <Sheet>
          <SheetTrigger asChild className="lg:hidden">
            <Button variant="outline" size="icon" aria-label="Navigation öffnen">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="top" className="max-h-[90svh] overflow-y-auto">
            <SheetHeader className="border-b px-5 py-5 text-left">
              <SheetTitle>Navigation</SheetTitle>
              <SheetDescription>Produkt, Beispiele und Zugang zu SitePitch.</SheetDescription>
            </SheetHeader>
            <div className="px-5 py-4">
              <MobileFeatureAccordion />
              <div className="mt-4 grid gap-1">
              {publicNavigation.links.slice(1).map((link) => (
                <SheetClose asChild key={link.href}>
                  <Link href={link.href} className="rounded-md px-3 py-3 text-base font-medium hover:bg-muted">
                    {link.label}
                  </Link>
                </SheetClose>
              ))}
              </div>
            </div>
            <div className="grid gap-2 border-t px-5 py-5 sm:grid-cols-2">
              <SheetClose asChild>
                <Button variant="outline" asChild>
                  <Link href={publicNavigation.login.href}>{publicNavigation.login.label}</Link>
                </Button>
              </SheetClose>
              <SheetClose asChild>
                <Button asChild>
                  <TrackedLink
                    href={publicNavigation.primaryCta.href}
                    eventName="marketing_cta_clicked"
                    eventSource="mobile_navbar"
                  >
                    {publicNavigation.primaryCta.label}
                  </TrackedLink>
                </Button>
              </SheetClose>
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </header>
  )
}
