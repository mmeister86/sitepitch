export type DisplayPlan = "free" | "starter" | "pro" | "agency" | "scale"

const PLAN_LABELS: Record<DisplayPlan, string> = {
  free: "Free-Plan · MVP",
  starter: "Starter-Plan",
  pro: "Pro-Plan",
  agency: "Agency-Plan",
  scale: "Scale-Plan",
}

export function getPlanLabel(plan: DisplayPlan | null | undefined) {
  return PLAN_LABELS[plan ?? "free"]
}
