export function shouldHydrateBrandingForm(
  hydratedVersion: number | null,
  persistedVersion: number
) {
  return hydratedVersion !== persistedVersion
}
