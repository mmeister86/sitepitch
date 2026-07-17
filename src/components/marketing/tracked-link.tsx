"use client"

import type { ComponentProps } from "react"
import Link from "next/link"

import { trackRybbitEvent } from "@/lib/analytics"

type TrackedLinkProps = ComponentProps<typeof Link> & {
  eventName: string
  eventSource: string
}

export function TrackedLink({ eventName, eventSource, onClick, ...props }: TrackedLinkProps) {
  return (
    <Link
      {...props}
      onClick={(event) => {
        trackRybbitEvent(eventName, { source: eventSource })
        onClick?.(event)
      }}
    />
  )
}
