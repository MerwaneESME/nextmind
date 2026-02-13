/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['docx'],
    missingSuspenseWithCSRBailout: false,
  },
};

export default nextConfig;

