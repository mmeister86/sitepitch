import { BrandingFormContent } from "@/components/branding-form-content"

export function BrandingSettingsView() {
  return (
    <div className="mx-auto w-full max-w-[900px] p-4 md:p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight">Report-Branding</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Diese Angaben erscheinen auf jedem geteilten Report.
        </p>
      </div>
      <BrandingFormContent />
    </div>
  )
}
