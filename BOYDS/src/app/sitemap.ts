import type { MetadataRoute } from 'next';
import { SERVICES, SERVICE_AREAS } from '@/features/site/content';

/**
 * The sitemap.
 *
 * Public pages only. Operations, dispatch, the driver app and sign-in are never
 * listed — a sitemap is a map of what is meant to be found.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const lastModified = new Date();

  const staticPages = [
    { path: '', priority: 1 },
    { path: '/services', priority: 0.9 },
    { path: '/service-areas', priority: 0.8 },
    { path: '/request-a-delivery', priority: 0.9 },
    { path: '/about', priority: 0.6 },
    { path: '/faq', priority: 0.6 },
    { path: '/contact', priority: 0.6 },
    { path: '/privacy', priority: 0.3 },
    { path: '/terms', priority: 0.3 },
  ];

  return [
    ...staticPages.map((page) => ({
      url: `${base}${page.path}`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: page.priority,
    })),
    ...SERVICES.map((service) => ({
      url: `${base}/services/${service.slug}`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    ...SERVICE_AREAS.map((area) => ({
      url: `${base}/service-areas/${area.slug}`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ];
}
