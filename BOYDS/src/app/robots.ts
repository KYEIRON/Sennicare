import type { MetadataRoute } from 'next';

/**
 * robots.txt
 *
 * The operations system, dispatch, the driver app and sign-in are excluded.
 * This is not a security control — those routes are protected by authentication
 * and row level security — but there is no reason for them to appear in a
 * search index.
 */
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/command-centre',
        '/jobs',
        '/requests',
        '/dispatch',
        '/incidents',
        '/customers',
        '/crm',
        '/quotes',
        '/invoices',
        '/reports',
        '/vehicles',
        '/drivers',
        '/settings',
        '/assistant',
        '/driver',
        '/sign-in',
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
