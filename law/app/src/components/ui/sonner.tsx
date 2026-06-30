import { useEffect, useState } from "react"
import {
  CheckCircle as CircleCheckIcon,
  Info as InfoIcon,
  CircleNotch as Loader2Icon,
  XCircle as OctagonXIcon,
  Warning as TriangleAlertIcon,
} from "@phosphor-icons/react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

function useDocumentTheme(): "dark" | "light" {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof document === "undefined") return "dark"
    return document.documentElement.classList.contains("dark") ? "dark" : "light"
  })
  useEffect(() => {
    if (typeof document === "undefined") return
    const sync = () =>
      setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light")
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })
    return () => observer.disconnect()
  }, [])
  return theme
}

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useDocumentTheme()

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
