import { CampaignDetailView } from "@/views/campaign-detail"

export default async function CampaignDetailPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params
  return <CampaignDetailView id={campaignId} />
}
