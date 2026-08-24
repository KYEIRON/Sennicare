import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // BOYD'S handles money and customer data. Fail the build on a type error
  // rather than shipping it — see CLAUDE.md section 9. Linting is a separate
  // step in `npm run verify`; Next 16 no longer runs it during the build.
  typescript: { ignoreBuildErrors: false },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            // Geolocation and camera are enabled for same-origin because the
            // driver application needs them. Everything else is denied.
            value: 'camera=(self), geolocation=(self), microphone=(), payment=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
