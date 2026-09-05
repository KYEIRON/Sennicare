import AsyncStorage from '@react-native-async-storage/async-storage';

export type CommonsImage = {
  url: string;
  author: string;
  license: string;
  source: string;
};

/**
 * `findCommonsFoodImage(food, country)` — the prototype's Commons API query,
 * with the same per-dish cache so a country sheet only searches once.
 */
export async function findCommonsImage(
  food: string,
  country: string
): Promise<CommonsImage | null> {
  const key = `nourishFoodImg:${country}|${food}`;
  try {
    const cached = await AsyncStorage.getItem(key);
    if (cached) return JSON.parse(cached) as CommonsImage;
  } catch {
    // fall through to a fresh lookup
  }

  const search = `File:${food} ${country}`;
  const url =
    'https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=' +
    encodeURIComponent(search) +
    '&gsrnamespace=6&gsrlimit=5&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=900&format=json&origin=*';

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Nourish/1.0 (prototype)' },
    });
    if (!response.ok) return null;
    const data = await response.json();
    const pages: any[] = Object.values(data?.query?.pages || {});
    const candidate = pages.find((p) => p?.imageinfo?.[0]?.thumburl || p?.imageinfo?.[0]?.url);
    const info = candidate?.imageinfo?.[0];
    if (!info) return null;
    const meta = info.extmetadata || {};
    const result: CommonsImage = {
      url: info.thumburl || info.url || '',
      author: String(meta.Artist?.value || '').replace(/<[^>]*>/g, ''),
      license: String(meta.LicenseShortName?.value || ''),
      source: 'Wikimedia Commons',
    };
    if (!result.url) return null;
    AsyncStorage.setItem(key, JSON.stringify(result)).catch(() => {});
    return result;
  } catch {
    return null;
  }
}
