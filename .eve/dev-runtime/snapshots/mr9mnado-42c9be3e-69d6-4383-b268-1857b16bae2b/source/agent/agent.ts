import { defineAgent } from "eve"

export default defineAgent({
  model: "openai/gpt-4.1-mini",
  limits: {
    maxInputTokensPerSession: 60_000,
    maxOutputTokensPerSession: 12_000,
  },
})
