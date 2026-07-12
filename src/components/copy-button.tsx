import { useState } from "react"
import { Copy, Check } from "lucide-react"

import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"
import { copyTextThen } from "@/lib/clipboard"

interface CopyButtonProps {
  text: string
  label?: string
  toastMessage?: string
  className?: string
  variant?: "default" | "outline" | "secondary" | "ghost"
  size?: "default" | "sm" | "icon"
  onCopied?: () => void | Promise<void>
}

export function CopyButton({
  text,
  label,
  toastMessage = "In die Zwischenablage kopiert",
  className,
  variant = "outline",
  size = "sm",
  onCopied,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await copyTextThen(text, async () => {
        setCopied(true)
        toast.success(toastMessage)
        setTimeout(() => setCopied(false), 1600)
        if (onCopied) {
          try {
            await onCopied()
          } catch {
            /* analytics failures must never block the copy feedback */
          }
        }
      })
    } catch {
      toast.error("Kopieren fehlgeschlagen")
      return
    }
  }

  return (
    <Button variant={variant} size={size} onClick={copy} className={cn("gap-1.5", className)}>
      {copied ? <Check className="size-4 text-score-strong" /> : <Copy className="size-4" />}
      {label && <span>{copied ? "Kopiert" : label}</span>}
    </Button>
  )
}
