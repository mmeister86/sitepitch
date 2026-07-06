"use client"

import { GooeyToaster, gooeyToast, type GooeyToasterProps } from "goey-toast"
import { useTheme } from "next-themes"

const Toaster = ({ ...props }: GooeyToasterProps) => {
  const { resolvedTheme, theme } = useTheme()
  const toastTheme = resolvedTheme === "dark" || theme === "dark" ? "dark" : "light"

  return (
    <GooeyToaster
      theme={toastTheme}
      position="bottom-right"
      preset="bouncy"
      closeButton
      closeOnEscape
      richColors
      swipeToDismiss
      {...props}
    />
  )
}

const toast = gooeyToast

export { Toaster, toast }
