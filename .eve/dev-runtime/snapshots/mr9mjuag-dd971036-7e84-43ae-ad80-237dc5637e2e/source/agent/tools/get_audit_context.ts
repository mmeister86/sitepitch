import { defineTool } from "eve/tools"
import { z } from "zod"

export default defineTool({
  description:
    "Fetch the minimal, validated audit context (scores, checks, signals) for a given audit id. Use before generating findings, summary, or outreach.",
  inputSchema: z.object({
    auditId: z.string().min(1),
  }),
  outputSchema: z.object({
    auditId: z.string(),
    domain: z.string(),
    reportLanguage: z.enum(["de", "en"]),
    overallScore: z.number(),
  }),
  async execute({ auditId }) {
    // In the Convex-driven path, context is loaded server-side and passed via
    // the message payload, so this tool is a no-op echo. When Eve runs as a
    // standalone server, wire this to the Convex HTTP API (see TASK-4.7).
    return {
      auditId,
      domain: "",
      reportLanguage: "de" as const,
      overallScore: 0,
    }
  },
})
