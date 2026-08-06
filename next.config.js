/**
 * Static export for GitHub Pages. `basePath` must match the repository name.
 * See PRD §11 — no server, no runtime fetches, `.nojekyll` written into ./out.
 */
const isProd = process.env.NODE_ENV === 'production'
const basePath = isProd ? '/isolation-anomaly' : ''

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
}

module.exports = nextConfig
