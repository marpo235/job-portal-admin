/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/job-portal-admin',
  images: {
    unoptimized: true,
  },
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

module.exports = nextConfig;
