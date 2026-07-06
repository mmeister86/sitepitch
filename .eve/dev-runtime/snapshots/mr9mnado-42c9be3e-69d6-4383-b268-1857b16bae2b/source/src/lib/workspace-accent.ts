export type WorkspaceAccentVariables = Record<`--${string}`, string>

type AccentStyleTarget = {
  setProperty: (property: string, value: string) => unknown
}

function channelToLinear(channel: number) {
  const value = channel / 255
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

function foregroundFor(hexColor: string) {
  const red = channelToLinear(Number.parseInt(hexColor.slice(1, 3), 16))
  const green = channelToLinear(Number.parseInt(hexColor.slice(3, 5), 16))
  const blue = channelToLinear(Number.parseInt(hexColor.slice(5, 7), 16))
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue
  return luminance > 0.45 ? "#171717" : "#ffffff"
}

export function getWorkspaceAccentVariables(accentColor: string): WorkspaceAccentVariables {
  const foreground = foregroundFor(accentColor)
  return {
    "--primary": accentColor,
    "--primary-foreground": foreground,
    "--ring": accentColor,
    "--chart-1": accentColor,
    "--sidebar-primary": accentColor,
    "--sidebar-primary-foreground": foreground,
    "--sidebar-ring": accentColor,
  }
}

export function applyWorkspaceAccent(target: AccentStyleTarget, accentColor: string) {
  const variables = getWorkspaceAccentVariables(accentColor)
  for (const [property, value] of Object.entries(variables)) {
    target.setProperty(property, value)
  }
}
