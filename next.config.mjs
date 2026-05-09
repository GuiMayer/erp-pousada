/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  turbopack: {
    // Explicitly set project root to silence workspace lockfile warning
    root: process.cwd(),
  },
}

export default nextConfig
