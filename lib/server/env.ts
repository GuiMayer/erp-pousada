import { loadEnvConfig } from "@next/env"

// CLI and Next.js must use the same precedence; explicit process variables win.
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production")
