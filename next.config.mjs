/** @type {import('next').NextConfig} */
const nextConfig = {
  // Isolated output for local validation without replacing a running development build.
  distDir: process.env.ERP_BUILD_DIR || ".next",

  poweredByHeader: false,
  async headers() { return [{ source: "/:path*", headers: [{ key: "X-Content-Type-Options", value: "nosniff" }, { key: "X-Frame-Options", value: "DENY" }, { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }, { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }] }] },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
