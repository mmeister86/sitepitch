import * as React from "react"
import { ChevronDown } from "lucide-react"
import { Accordion as AccordionPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

const Expandable = AccordionPrimitive.Root

const ExpandableItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    data-slot="expandable-item"
    className={cn("group border-b last:border-b-0", className)}
    {...props}
  />
))
ExpandableItem.displayName = "ExpandableItem"

const ExpandableTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger> & {
    action?: React.ReactNode
  }
>(({ className, children, action, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex items-center gap-3">
    <AccordionPrimitive.Trigger
      ref={ref}
      data-slot="expandable-trigger"
      className={cn(
        "flex flex-1 items-center justify-between gap-4 py-4 text-left text-sm font-medium transition-all outline-none hover:underline focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&[data-state=open]>svg]:rotate-180",
        className,
      )}
      {...props}
    >
      {children}
      {!action && (
        <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
      )}
    </AccordionPrimitive.Trigger>
    {action}
    {action && (
      <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
    )}
  </AccordionPrimitive.Header>
))
ExpandableTrigger.displayName = "ExpandableTrigger"

const ExpandableContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    data-slot="expandable-content"
    className="overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
    {...props}
  >
    <div className={cn("pb-4 pt-0", className)}>{children}</div>
  </AccordionPrimitive.Content>
))
ExpandableContent.displayName = "ExpandableContent"

export { Expandable, ExpandableItem, ExpandableTrigger, ExpandableContent }
