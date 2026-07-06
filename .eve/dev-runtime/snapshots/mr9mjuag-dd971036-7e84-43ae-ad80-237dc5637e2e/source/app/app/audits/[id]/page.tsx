import { AuditDetailView } from "@/views/audit-detail"

export default async function AppAuditDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <AuditDetailView id={id} />
}
