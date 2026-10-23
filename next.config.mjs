const staticDemo = process.env.ERP_STATIC_DEMO === "true"
if (staticDemo && process.env.NEXT_PUBLIC_DATA_ADAPTER !== "demo-localStorage") {
  throw new Error("A exportação estática exige o adaptador demo-localStorage")
}
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ""
if (basePath && !/^\/[a-zA-Z0-9_-]+$/.test(basePath)) throw new Error("Caminho público inválido")

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Isolated output for local validation without replacing a running development build.
  distDir: process.env.ERP_BUILD_DIR || ".next",

  poweredByHeader: false,
  ...(staticDemo ? {
    output: "export",
    // All UI entrypoints are .tsx; server route handlers are .ts. Imports of .ts
    // utilities still work. Verify the generated route manifest before publishing.
    pageExtensions: ["tsx", "jsx"],
    basePath,
    trailingSlash: true,
  } : {}),
  ...(!staticDemo ? { async headers() { return [{ source: "/:path*", headers: [{ key: "X-Content-Type-Options", value: "nosniff" }, { key: "X-Frame-Options", value: "DENY" }, { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }, { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }] }] } } : {}),
  images: {
    unoptimized: true,
  },
}

export default nextConfig
