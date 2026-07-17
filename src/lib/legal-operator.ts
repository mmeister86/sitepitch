export interface LegalOperator {
  name: string
  address: string
  email: string
}

export const LEGAL_OPERATOR_ENV_KEYS = [
  "LEGAL_OPERATOR_NAME",
  "LEGAL_OPERATOR_ADDRESS",
  "LEGAL_OPERATOR_EMAIL",
] as const

export function getLegalOperator(): LegalOperator | null {
  const name = process.env.LEGAL_OPERATOR_NAME?.trim()
  const address = process.env.LEGAL_OPERATOR_ADDRESS?.trim()
  const email = process.env.LEGAL_OPERATOR_EMAIL?.trim()

  if (!name || !address || !email) return null
  return { name, address, email }
}
