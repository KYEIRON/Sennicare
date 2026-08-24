import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CAPABILITIES,
  FINANCIAL_CAPABILITIES,
  can,
  capabilitiesFor,
  homeRouteFor,
  type Capability,
} from '@/lib/permissions';
import { USER_ROLES, USER_STATUSES } from '@/types/auth';

describe('the driver boundary', () => {
  it('grants a driver NO capability that exposes company financial information', () => {
    // Business rules 28 and 29. This is the single most important permission
    // assertion in BOYD'S: a driver must never reach a price, a cost, a
    // contribution, a margin, a customer list, an invoice, a quote, or a
    // pricing rule.
    const driverCapabilities = capabilitiesFor('DRIVER');
    const leaked = FINANCIAL_CAPABILITIES.filter((c) => driverCapabilities.includes(c));

    expect(leaked).toEqual([]);
  });

  it.each(FINANCIAL_CAPABILITIES)('denies a driver %s', (capability) => {
    expect(can('DRIVER', capability)).toBe(false);
  });

  it('does not let a driver see all jobs', () => {
    expect(can('DRIVER', 'jobs.view.all')).toBe(false);
    expect(can('DRIVER', 'jobs.view.assigned')).toBe(true);
  });

  it('does not let a driver assign work or manage users and settings', () => {
    expect(can('DRIVER', 'jobs.assign')).toBe(false);
    expect(can('DRIVER', 'users.manage')).toBe(false);
    expect(can('DRIVER', 'settings.manage')).toBe(false);
    expect(can('DRIVER', 'audit.view')).toBe(false);
  });

  it('DOES let a driver do the field work the job requires', () => {
    expect(can('DRIVER', 'jobs.advance_field_status')).toBe(true);
    expect(can('DRIVER', 'mileage.record')).toBe(true);
    expect(can('DRIVER', 'fuel.record')).toBe(true);
    expect(can('DRIVER', 'expenses.record')).toBe(true);
    expect(can('DRIVER', 'documents.upload')).toBe(true);
    expect(can('DRIVER', 'vehicles.view.assigned')).toBe(true);
  });

  it('is enumerated, so a NEW capability is denied to drivers by default', () => {
    // Driver capabilities are listed explicitly rather than derived by
    // subtraction. Adding a capability anywhere else in BOYD'S must never
    // silently grant it to the driver surface.
    const driverCapabilities = capabilitiesFor('DRIVER');
    const notGranted = CAPABILITIES.filter((c) => !driverCapabilities.includes(c));

    expect(notGranted.length).toBeGreaterThan(0);
    expect(driverCapabilities.length).toBeLessThan(CAPABILITIES.length);
  });
});

describe('partner capabilities', () => {
  it('gives partners the business access their responsibilities require', () => {
    const expected: Capability[] = [
      'jobs.view.all',
      'jobs.create',
      'jobs.assign',
      'customers.manage',
      'vehicles.manage',
      'financials.view',
      'pricing.manage',
      'quotes.manage',
      'invoices.manage',
      'reports.view',
      'settings.manage',
      'audit.view',
    ];
    for (const capability of expected) {
      expect(can('PARTNER', capability)).toBe(true);
    }
  });

  it('does not give partners user administration', () => {
    // Partners run the business; creating and suspending accounts is an admin
    // action, kept separate so it is deliberate and audited.
    expect(can('PARTNER', 'users.manage')).toBe(false);
  });

  it('gives admins every capability', () => {
    for (const capability of CAPABILITIES) {
      expect(can('ADMIN', capability)).toBe(true);
    }
  });
});

describe('sign-in routing', () => {
  it('sends a driver to the driver app, never the management system', () => {
    expect(homeRouteFor('DRIVER')).toBe('/today');
  });

  it('sends partners and admins to the Command Centre', () => {
    expect(homeRouteFor('PARTNER')).toBe('/command-centre');
    expect(homeRouteFor('ADMIN')).toBe('/command-centre');
  });
});

describe('TypeScript and Postgres agree on identity enums', () => {
  const migration = readFileSync(
    join(process.cwd(), 'supabase/migrations/0001_extensions_and_enums.sql'),
    'utf8',
  );

  function enumValues(name: string): string[] {
    const match = migration.match(
      new RegExp(`create type ${name} as enum \\(([^)]+)\\)`),
    );
    return (match?.[1] ?? '')
      .split(',')
      .map((v) => v.trim().replace(/^'|'$/g, ''))
      .filter(Boolean);
  }

  it('defines the same user roles in both places', () => {
    expect(enumValues('user_role')).toEqual([...USER_ROLES]);
  });

  it('defines the same user statuses in both places', () => {
    expect(enumValues('user_status')).toEqual([...USER_STATUSES]);
  });
});
