export const CREDIT_PACK_SIZE = 25

export type PaidPlan = "starter" | "pro" | "agency"

export type LemonVariantConfig = {
  starter?: string
  pro?: string
  agency?: string
  creditPack?: string
}

export function planForVariant(variantId: string, variants: LemonVariantConfig): PaidPlan | null {
  if (variantId === variants.starter) return "starter"
  if (variantId === variants.pro) return "pro"
  if (variantId === variants.agency) return "agency"
  return null
}

export function isCreditPackVariant(variantId: string, variants: LemonVariantConfig) {
  return Boolean(variants.creditPack && variantId === variants.creditPack)
}

export function timingSafeHexEqual(left: string, right: string) {
  if (!/^[0-9a-f]+$/i.test(left) || !/^[0-9a-f]+$/i.test(right) || left.length !== right.length) {
    return false
  }
  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return difference === 0
}

export function parseTimestamp(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : undefined
}
