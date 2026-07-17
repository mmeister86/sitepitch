import { Workpool } from "@convex-dev/workpool"
import { components } from "./_generated/api"

export const auditWorkpool = new Workpool(components.auditWorkpool, {
  maxParallelism: 2,
  retryActionsByDefault: true,
  defaultRetryBehavior: { maxAttempts: 2, initialBackoffMs: 5_000, base: 2 },
  logLevel: "WARN",
})

export const batchAuditWorkpool = new Workpool(components.batchAuditWorkpool, {
  maxParallelism: 4,
  retryActionsByDefault: true,
  defaultRetryBehavior: { maxAttempts: 2, initialBackoffMs: 5_000, base: 2 },
  logLevel: "WARN",
})

export const providerWorkpool = new Workpool(components.providerWorkpool, {
  maxParallelism: 4,
  retryActionsByDefault: false,
  logLevel: "WARN",
})

export const llmWorkpool = new Workpool(components.llmWorkpool, {
  maxParallelism: 2,
  retryActionsByDefault: true,
  defaultRetryBehavior: { maxAttempts: 2, initialBackoffMs: 10_000, base: 2 },
  logLevel: "WARN",
})

export const pdfWorkpool = new Workpool(components.pdfWorkpool, {
  maxParallelism: 1,
  retryActionsByDefault: false,
  logLevel: "WARN",
})

export const webhookWorkpool = new Workpool(components.webhookWorkpool, {
  maxParallelism: 4,
  retryActionsByDefault: false,
  logLevel: "WARN",
})
