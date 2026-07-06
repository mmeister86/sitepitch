import { cn } from "@/lib/utils"

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={cn("size-8", className)}
      aria-hidden
    >
      <rect width="32" height="32" rx="9" fill="var(--sidebar-primary)" />
      <rect x="8" y="17" width="3.4" height="7" rx="1.2" fill="var(--sidebar-primary-foreground)" opacity="0.55" />
      <rect x="14.3" y="13" width="3.4" height="11" rx="1.2" fill="var(--sidebar-primary-foreground)" opacity="0.8" />
      <rect x="20.6" y="8" width="3.4" height="16" rx="1.2" fill="var(--sidebar-primary-foreground)" />
      <circle cx="22.3" cy="8" r="2.4" fill="var(--sidebar-primary-foreground)" stroke="var(--sidebar-primary)" strokeWidth="1.6" />
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <div className="flex flex-col leading-none">
        <span className="text-[15px] font-semibold tracking-tight text-sidebar-foreground">
          SitePitch
        </span>
        <span className="text-[11px] font-medium text-sidebar-foreground/50">
          Akquise-Workspace
        </span>
      </div>
    </div>
  )
}
