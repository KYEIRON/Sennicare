/**
 * BOYD'S identity and authorisation types.
 *
 * These mirror the Postgres enums in supabase/migrations/0001. A test asserts
 * the two definitions agree, so a role added in one place cannot go missing in
 * the other.
 */

export const USER_ROLES = ['PARTNER', 'DRIVER', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ['ACTIVE', 'INVITED', 'SUSPENDED', 'INACTIVE'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

/** The signed-in person, as the application sees them. */
export interface AppUser {
  readonly id: string;
  readonly authUserId: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string | null;
  readonly role: UserRole;
  readonly status: UserStatus;
}

/** A partner record. Compensation treatment is deliberately absent — D-011. */
export interface Partner {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly roleTitle: string;
  readonly responsibilities: readonly string[];
  readonly active: boolean;
}

/** A driver record. Licence fields are null until BOYD'S supplies real values. */
export interface Driver {
  readonly id: string;
  readonly userId: string;
  readonly licenseNumber: string | null;
  readonly licenseState: string | null;
  readonly licenseExpiry: string | null;
  readonly phone: string | null;
  readonly active: boolean;
}
