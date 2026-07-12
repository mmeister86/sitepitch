export type ClipboardWriter = (text: string) => Promise<void>

export async function writeTextToClipboard(
  text: string,
  writeText: ClipboardWriter = (value) => navigator.clipboard.writeText(value),
): Promise<void> {
  await writeText(text)
}

export async function copyTextThen(
  text: string,
  onCopied: () => void | Promise<void>,
  writeText?: ClipboardWriter,
): Promise<void> {
  await writeTextToClipboard(text, writeText)
  await onCopied()
}
