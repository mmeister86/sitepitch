import type { Metadata } from "next"

import { PublicReportView } from "@/views/public-report"

export const metadata: Metadata = {
  title: "Audit-Report | SitePitch",
  description: "Professioneller Website-Audit-Report",
  robots: { index: false, follow: false },
}

export default async function PublicReportPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return <PublicReportView slug={slug} />
}
