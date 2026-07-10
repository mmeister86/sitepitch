"use client"

import { useState, type ReactNode } from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { NewAuditForm } from "./new-audit-form"

export function NewAuditDialog({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Neuen Audit starten</DialogTitle>
          <DialogDescription>
            Analysiere eine öffentlich erreichbare Website und erstelle einen gebrandeten Report.
          </DialogDescription>
        </DialogHeader>
        <div className="py-1">
          <NewAuditForm
            showCancel
            onCancel={() => setOpen(false)}
            onStarted={() => setOpen(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
