import { describe, expect, test, vi } from "vitest"

import { copyTextThen, writeTextToClipboard } from "./clipboard"

describe("writeTextToClipboard", () => {
  test("resolves only after the clipboard write succeeds", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    await expect(writeTextToClipboard("hello", writeText)).resolves.toBeUndefined()
    expect(writeText).toHaveBeenCalledWith("hello")
  })

  test("runs post-copy cleanup after a successful clipboard write", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    const onCopied = vi.fn()
    await expect(copyTextThen("secret", onCopied, writeText)).resolves.toBeUndefined()
    expect(writeText).toHaveBeenCalledWith("secret")
    expect(onCopied).toHaveBeenCalledOnce()
  })

  test("propagates clipboard rejection so callers cannot emit success events", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"))
    const onCopied = vi.fn()
    await expect(copyTextThen("secret", onCopied, writeText)).rejects.toThrow("denied")
    expect(onCopied).not.toHaveBeenCalled()
  })
})
