/// <reference types="vite/client" />

interface ImportMeta {
  glob<T = unknown>(
    pattern: string | readonly string[],
    options?: {
      eager?: boolean
      import?: string
      as?: string
    },
  ): Record<string, T>
}
