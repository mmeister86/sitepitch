import { BatchAuditDetailView } from "@/views/batch-audit-detail"

export default async function AppBatchAuditDetailPage({
  params,
}: {
  params: Promise<{ batchId: string }>
}) {
  const { batchId } = await params
  return <BatchAuditDetailView id={batchId} />
}

