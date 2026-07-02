import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"

export type View =
  | { name: "dashboard" }
  | { name: "audits" }
  | { name: "audit"; id: string }
  | { name: "leads" }
  | { name: "campaigns" }
  | { name: "settings" }

function parseHash(): View {
  const hash = window.location.hash.replace(/^#\/?/, "")
  const parts = hash.split("/").filter(Boolean)
  if (parts[0] === "audits" && parts[1]) return { name: "audit", id: parts[1] }
  if (parts[0] === "audits") return { name: "audits" }
  if (parts[0] === "leads") return { name: "leads" }
  if (parts[0] === "campaigns") return { name: "campaigns" }
  if (parts[0] === "settings") return { name: "settings" }
  return { name: "dashboard" }
}

function viewToHash(view: View): string {
  switch (view.name) {
    case "dashboard":
      return "#/"
    case "audit":
      return `#/audits/${view.id}`
    default:
      return `#/${view.name}`
  }
}

interface RouterContextValue {
  view: View
  navigate: (view: View) => void
}

const RouterContext = createContext<RouterContextValue | null>(null)

export function RouterProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>(parseHash)

  useEffect(() => {
    const onChange = () => setView(parseHash())
    window.addEventListener("hashchange", onChange)
    return () => window.removeEventListener("hashchange", onChange)
  }, [])

  const navigate = (next: View) => {
    window.location.hash = viewToHash(next)
    setView(next)
    window.scrollTo({ top: 0 })
  }

  return (
    <RouterContext.Provider value={{ view, navigate }}>
      {children}
    </RouterContext.Provider>
  )
}

export function useRouter() {
  const ctx = useContext(RouterContext)
  if (!ctx) throw new Error("useRouter must be used within RouterProvider")
  return ctx
}
