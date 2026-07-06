const LEGACY_MOCK_USER_NAME = "Jana Roth"
const LEGACY_MOCK_WORKSPACE_NAME = "Nordpixel Studio"

export function getUserDisplayName(name: string | null | undefined, email: string | null | undefined) {
  const trimmedName = name?.trim()
  if (trimmedName) return trimmedName

  const emailName = email?.split("@")[0]?.trim()
  return emailName || "Workspace-Inhaber"
}

export function getFirstName(displayName: string) {
  return displayName.trim().split(/\s+/)[0] || displayName
}

export function personalizeOutreachText(
  text: string,
  displayName: string,
  workspaceName: string
) {
  return text
    .replaceAll(LEGACY_MOCK_USER_NAME, displayName)
    .replaceAll(LEGACY_MOCK_WORKSPACE_NAME, workspaceName)
}
