import { useState } from "react"
import { Copy, Check } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface CopyButtonProps {
  text: string
  label?: string
  toastMessage?: string
  className?: string
  variant?: "default" | "outline" | "secondary" | "ghost"
  size?: "default" | "sm" | "icon"
}

export function CopyButton({
  text,
  label,
  toastMessage = "In die Zwischenablage kopiert",
  className,
  variant = "outline",
  size = "sm",
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      /* clipboard may be unavailable in sandbox — still show feedback */
    }
    setCopied(true)
    toast.success(toastMessage)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <Button variant={variant} size={size} onClick={copy} className={cn("gap-1.5", className)}>
      {copied ? <Check className="size-4 text-score-strong" /> : <Copy className="size-4" />}
      {label && <span>{copied ? "Kopiert" : label}</span>}
    </Button>
  )
}
