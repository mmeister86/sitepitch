export const BATCH_QA_RULE_VERSION = "batch-qa-v1"

export function batchQaSampleSize(totalItems: number) {
  if (!Number.isInteger(totalItems) || totalItems < 1) return 0
  return Math.min(10, Math.max(1, Math.ceil(totalItems * 0.1)))
}

export function isBatchQaPositionSelected(position: number, totalItems: number) {
  const sampleSize = batchQaSampleSize(totalItems)
  if (sampleSize === 0 || position < 0 || position >= totalItems) return false
  for (let sampleIndex = 0; sampleIndex < sampleSize; sampleIndex += 1) {
    if (position === Math.floor((sampleIndex * totalItems) / sampleSize)) return true
  }
  return false
}
