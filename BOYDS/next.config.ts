import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  experimental: {
    // Turbopack's scope hoisting (Next 16.3.6) inlined the integration
    // selectors, e.g. getMaps(), into the Settings page but dropped the
    // declaration they return, so production /settings failed with
    // "ReferenceError: unavailableMaps is not defined" (D-052). Without scope
    // hoisting each module keeps its own scope. Remove only after a Next
    // upgrade is shown to render /settings for a signed-in partner;
    // tests/guards/next-config.test.ts stops it being dropped unnoticed.
    turbopackScopeHoisting: false,
  },

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
