/** @type {import('next').NextConfig} */
const nextConfig = {
  // better-sqlite3 是原生模組，不可被打包，交由 Node 直接 require
  webpack: (config) => {
    config.externals = [...(config.externals ?? []), 'better-sqlite3']
    return config
  },
  // 讓 better-sqlite3 在 server runtime 以外部模組載入
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
}

export default nextConfig
