import { unavailableMaps } from './unavailable-maps';
import type { MapsProvider } from './types';

/**
 * Select the maps provider.
 *
 * BOYD'S has not connected one. When it does, the live adapter goes here and
 * nothing downstream changes — every caller already handles the unavailable
 * case, because it has had to from the start.
 */
export function getMaps(): MapsProvider {
  const provider = process.env.MAPS_PROVIDER;
  const apiKey = process.env.MAPS_API_KEY;

  if (!provider || !apiKey) return unavailableMaps;

  // No live adapter is implemented yet. Reporting unavailable is the honest
  // answer: a half-configured provider must not appear to work.
  return unavailableMaps;
}

export * from './types';
