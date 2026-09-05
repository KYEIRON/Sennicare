import { Image } from 'expo-image';
import { media } from './content';

/**
 * Offline.
 *
 * Cooking happens in kitchens with bad signal. The content itself — 597 dishes,
 * 32 recipes, every method and substitution — is bundled JSON, so it is
 * available with no network at all. Images are the part that needs warming.
 *
 * The fallback chain the brief asks for is: technique clip → step photo → dish
 * photo → plain dark field. Never a broken icon, never an empty box.
 */

/** Photographs worth having before the first tap. */
export function criticalImages(limit = 12): string[] {
  const briefed = media.filter((m) => m.status === 'briefed').map((m) => m.url);
  const rest = media.filter((m) => m.status !== 'briefed').map((m) => m.url);
  return [...briefed, ...rest].slice(0, limit);
}

/** Warm the disk cache so a cold start is not a blank screen. */
export async function warmImageCache(urls: string[] = criticalImages()): Promise<number> {
  let cached = 0;
  await Promise.all(
    urls.map(async (url) => {
      try {
        await Image.prefetch(url, { cachePolicy: 'disk' });
        cached += 1;
      } catch {
        // A failed prefetch is not an error worth surfacing: the fallback chain
        // covers it, and the next attempt is the screen that needs it.
      }
    })
  );
  return cached;
}

/** Everything the app needs to work offline, once. */
export async function prepareOffline(): Promise<{ images: number }> {
  const images = await warmImageCache();
  return { images };
}

/**
 * What to show when there is no photograph.
 *
 * Returning a colour rather than nothing is what keeps a broken icon off the
 * screen; the caller renders the field and puts the dish name on it.
 */
export function fallbackField(seed: string): string {
  const fields = ['#2c2f2a', '#3a352c', '#2f3330', '#38312b'];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 997;
  return fields[hash % fields.length];
}
