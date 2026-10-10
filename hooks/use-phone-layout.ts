"use client"
import { useEffect, useState } from "react"

// Matches the existing sm breakpoint; tablet and desktop keep their current UI.
export function usePhoneLayout() {
  const [phone, setPhone] = useState(false)
  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)")
    const update = () => setPhone(query.matches)
    update(); query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])
  return phone
}
