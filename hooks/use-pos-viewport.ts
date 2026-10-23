"use client"
import { useEffect, useState, type CSSProperties } from "react"

/** Keep POS dialogs inside the visible area when the phone keyboard opens. */
export function usePOSViewport(enabled: boolean): CSSProperties {
  const [viewport, setViewport] = useState<{ height: number; top: number } | null>(null)
  useEffect(() => {
    if (!enabled) return
    const visual = window.visualViewport
    const update = () => setViewport({ height: visual?.height ?? window.innerHeight, top: visual?.offsetTop ?? 0 })
    update()
    visual?.addEventListener("resize", update); visual?.addEventListener("scroll", update); window.addEventListener("resize", update)
    return () => { visual?.removeEventListener("resize", update); visual?.removeEventListener("scroll", update); window.removeEventListener("resize", update) }
  }, [enabled])
  return enabled && viewport ? { "--pos-viewport-height": `${viewport.height}px`, "--pos-viewport-top": `${viewport.top}px` } as CSSProperties : {}
}
