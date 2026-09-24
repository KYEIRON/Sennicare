/**
 * Maps and location for BOYD'S.
 *
 * BOYD'S has no maps provider connected. Every function here returns an
 * explicit UNAVAILABLE result until one is, and the interface renders
 * "Live tracking unavailable" or "GPS NOT CONNECTED".
 *
 * Nothing estimates a position, a distance or an arrival time. A fabricated ETA
 * is worse than none: a customer plans around it.
 */

import type { Result } from '@/lib/result';
import type { MilesTenths } from '@/types/branded';

export interface Coordinates {
  readonly latitude: number;
  readonly longitude: number;
}

export interface Address {
  readonly line1: string;
  readonly city: string;
  readonly state: string;
  readonly zip: string;
}

export interface RouteResult {
  readonly miles: MilesTenths;
  readonly durationMinutes: number;
}

export interface VehiclePosition {
  readonly coordinates: Coordinates;
  readonly recordedAt: Date;
}

export interface MapsProvider {
  readonly name: string;
  readonly available: boolean;

  geocode(address: Address): Promise<Result<Coordinates>>;
  route(stops: readonly Address[]): Promise<Result<RouteResult>>;
  vehiclePosition(vehicleId: string): Promise<Result<VehiclePosition>>;
}

/** What the interface shows where a map or a position would be. */
export const MAPS_UNAVAILABLE_MESSAGE = 'Live tracking unavailable';
export const GPS_UNAVAILABLE_MESSAGE = 'GPS NOT CONNECTED';
