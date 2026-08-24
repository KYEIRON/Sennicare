import { domainError, err, type Result } from '@/lib/result';
import type { Coordinates, MapsProvider, RouteResult, VehiclePosition } from './types';

/**
 * The unavailable maps provider.
 *
 * Selected until BOYD'S connects a maps provider. Every call fails explicitly.
 *
 * There is deliberately no "approximate" fallback — no straight-line distance
 * standing in for a route, no last-known position standing in for a live one.
 * An approximation here would not stay here: it would flow into a fuel
 * estimate, into a cost, into a price, and reach a customer as a number nobody
 * could trace back to a guess.
 */
const UNAVAILABLE = domainError(
  'maps/unavailable',
  'No maps provider is connected. Mileage is entered manually and location is not tracked.',
);

export const unavailableMaps: MapsProvider = {
  name: 'unavailable',
  available: false,

  async geocode(): Promise<Result<Coordinates>> {
    return err(UNAVAILABLE);
  },
  async route(): Promise<Result<RouteResult>> {
    return err(UNAVAILABLE);
  },
  async vehiclePosition(): Promise<Result<VehiclePosition>> {
    return err(UNAVAILABLE);
  },
};
