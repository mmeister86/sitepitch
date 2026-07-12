import { auditExamples } from "@/lib/audit-examples"
import { cn } from "@/lib/utils"

export function AuditExampleLinks({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs", className)}>
      <span className="text-muted-foreground">Beispiele:</span>
      {auditExamples.map((example) => (
        <a key={example.slug} href={`/examples/${example.slug}`} className="font-medium text-primary hover:underline">
          {example.title}
        </a>
      ))}
    </div>
  )
}
