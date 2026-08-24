import { describe, expect, it } from 'vitest';
import {
  buildBreakdown,
  checkAgainstFloor,
  estimateCost,
  evaluatePrice,
  priceJob,
  requireMiles,
  sumQuoteItems,
  type PricingInputs,
  type PricingPolicy,
} from '@/services/finance/pricing';
import { cents, milesTenths, mpgTenths } from '@/types/branded';
import { BUSINESS_SETTINGS } from '@/lib/configured';

/** A job with every real input recorded. */
function inputs(overrides: Partial<PricingInputs> = {}): PricingInputs {
  return {
    miles: milesTenths(1000), // 100.0 miles
    fuelPricePerGallonCents: 350,
    vehicleMpg: mpgTenths(200), // 20.0 MPG
    vehicleCostPerMileCents: 25,
    driverLabourBasis: { kind: 'PER_MILE', rate: cents(40) },
    estimatedHours: null,
    expectedTollsCents: 500,
    expectedParkingCents: null,
    otherCostsCents: null,
    urgencyMultiplierBps: null,
    ...overrides,
  };
}

/** BOYD'S has decided nothing yet. This is the real current state. */
const NOTHING_CONFIGURED: PricingPolicy = {
  minimumContributionCents: null,
  minimumContributionPerMileCents: null,
  targetMarginBps: null,
};

describe('cost estimation', () => {
  it('builds every line from real recorded inputs', () => {
    const result = estimateCost(inputs());
    expect(result.status).toBe('OK');

    if (result.status === 'OK') {
      // Fuel: 100 mi / 20 MPG = 5 gal at $3.50 = $17.50
      // Driver: 100 mi at $0.40 = $40.00
      // Vehicle: 100 mi at $0.25 = $25.00
      // Tolls: $5.00  →  $87.50
      expect(result.value.total).toBe(8750);
      expect(result.value.lines.map((l) => l.label)).toEqual([
        'Fuel',
        'Driver',
        'Vehicle',
        'Tolls',
      ]);
    }
  });

  it('states the basis of every line, so a price can be explained', () => {
    const result = estimateCost(inputs());
    if (result.status === 'OK') {
      for (const line of result.value.lines) {
        expect(line.basis.length).toBeGreaterThan(0);
      }
      expect(result.value.lines[0]!.basis).toContain('gal');
    }
  });

  it('refuses to estimate fuel without a real price or a real MPG', () => {
    expect(estimateCost(inputs({ fuelPricePerGallonCents: null }))).toMatchObject({
      status: 'DATA_INCOMPLETE',
      missing: ['fuel_price_per_gallon'],
    });
    expect(estimateCost(inputs({ vehicleMpg: null }))).toMatchObject({
      status: 'DATA_INCOMPLETE',
      missing: ['vehicle_fuel_economy'],
    });
  });

  it('refuses to estimate without a derived vehicle cost per mile', () => {
    const result = estimateCost(inputs({ vehicleCostPerMileCents: null }));
    expect(result.status).toBe('DATA_INCOMPLETE');
    if (result.status === 'DATA_INCOMPLETE') {
      expect(result.missing).toEqual(['vehicle_cost_per_mile']);
    }
  });

  it('reports every missing input at once, not one at a time', () => {
    const result = estimateCost(
      inputs({ fuelPricePerGallonCents: null, vehicleCostPerMileCents: null }),
    );
    if (result.status === 'DATA_INCOMPLETE') {
      expect(result.missing).toEqual(['fuel_price_per_gallon', 'vehicle_cost_per_mile']);
    }
  });

  it('reports NOT CONFIGURED when the driver labour basis is undecided', () => {
    const result = estimateCost(inputs({ driverLabourBasis: null }));
    expect(result).toEqual({
      status: 'NOT_CONFIGURED',
      setting: BUSINESS_SETTINGS.DRIVER_LABOUR_COST_BASIS,
    });
  });

  it('labels an estimate that excludes driving labour', () => {
    const result = estimateCost(
      inputs({ driverLabourBasis: { kind: 'EXCLUDED_FROM_JOB_COST' } }),
    );

    if (result.status === 'OK') {
      // $87.50 less the $40 driver line.
      expect(result.value.total).toBe(4750);
      expect(result.value.labourTreatment).toBe('BEFORE_LABOUR_COST');
      expect(result.value.lines.map((l) => l.label)).not.toContain('Driver');
    }
  });

  it('costs labour per hour when that is the chosen basis', () => {
    const result = estimateCost(
      inputs({
        driverLabourBasis: { kind: 'PER_HOUR', rate: cents(2500) },
        estimatedHours: 2.5,
      }),
    );
    if (result.status === 'OK') {
      const driver = result.value.lines.find((l) => l.label === 'Driver');
      expect(driver?.amount).toBe(6250);
    }
  });

  it('needs the hours when labour is costed per hour', () => {
    const result = estimateCost(
      inputs({ driverLabourBasis: { kind: 'PER_HOUR', rate: cents(2500) } }),
    );
    if (result.status === 'DATA_INCOMPLETE') {
      expect(result.missing).toContain('estimated_hours');
    }
  });
});

describe('pricing with nothing configured — BOYD’S current state', () => {
  it('still produces a cost estimate', () => {
    const result = priceJob(inputs(), NOTHING_CONFIGURED);
    expect(result.status).toBe('OK');
    if (result.status === 'OK') expect(result.value.estimate.total).toBe(8750);
  });

  it('reports NOT CONFIGURED for the minimum price, naming the decision', () => {
    const result = priceJob(inputs(), NOTHING_CONFIGURED);
    if (result.status === 'OK') {
      expect(result.value.minimumPrice).toEqual({
        status: 'NOT_CONFIGURED',
        setting: BUSINESS_SETTINGS.MINIMUM_CONTRIBUTION_PER_JOB,
      });
    }
  });

  it('reports NOT CONFIGURED for the target price', () => {
    const result = priceJob(inputs(), NOTHING_CONFIGURED);
    if (result.status === 'OK') {
      expect(result.value.targetPrice).toEqual({
        status: 'NOT_CONFIGURED',
        setting: BUSINESS_SETTINGS.TARGET_CONTRIBUTION_MARGIN,
      });
    }
  });

  it('never invents a recommended price', () => {
    const result = priceJob(inputs(), NOTHING_CONFIGURED);
    const serialised = JSON.stringify(result);
    expect(serialised).not.toContain('"targetPrice":{"status":"OK"');
    expect(serialised).not.toContain('"minimumPrice":{"status":"OK"');
  });
});

describe('pricing once the partners decide', () => {
  const policy: PricingPolicy = {
    minimumContributionCents: 5_000,
    minimumContributionPerMileCents: 50,
    targetMarginBps: 2_000,
  };

  it('computes the minimum price as cost plus the floor', () => {
    const result = priceJob(inputs(), policy);
    if (result.status === 'OK') {
      expect(result.value.minimumPrice).toEqual({ status: 'OK', value: 13_750 });
    }
  });

  it('grosses cost up to the target margin', () => {
    // $87.50 at a 20% margin = $109.38
    const result = priceJob(inputs(), policy);
    if (result.status === 'OK') {
      expect(result.value.targetPrice).toEqual({ status: 'OK', value: 10_938 });
    }
  });

  it('refuses an impossible target margin rather than dividing by zero', () => {
    const result = priceJob(inputs(), { ...policy, targetMarginBps: 10_000 });
    if (result.status === 'OK') {
      expect(result.value.targetPrice.status).toBe('NOT_CALCULABLE');
    }
  });

  it('applies an urgency uplift to the price, not to the cost estimate', () => {
    const result = priceJob(inputs({ urgencyMultiplierBps: 12_500 }), policy);
    if (result.status === 'OK') {
      // The estimate is unchanged; the reference prices reflect the uplift.
      expect(result.value.estimate.total).toBe(8_750);
      expect(result.value.urgencyApplied).toBe(12_500);
      if (result.value.minimumPrice.status === 'OK') {
        expect(result.value.minimumPrice.value).toBe(15_938);
      }
    }
  });
});

describe('evaluating a price', () => {
  const estimate = estimateCost(inputs());

  it('reports what a price would actually earn', () => {
    if (estimate.status !== 'OK') throw new Error('estimate failed');

    const option = evaluatePrice(cents(15_000), estimate.value, milesTenths(1000));
    expect(option.contribution).toBe(6_250);
    expect(option.contributionPerMile).toEqual({ status: 'OK', value: 63 });
  });

  it('reports a negative contribution on a price below cost', () => {
    if (estimate.status !== 'OK') throw new Error('estimate failed');

    const option = evaluatePrice(cents(5_000), estimate.value, milesTenths(1000));
    expect(option.contribution).toBe(-3_750);
  });
});

describe('the floor check', () => {
  const estimate = estimateCost(inputs());

  function optionAt(price: number) {
    if (estimate.status !== 'OK') throw new Error('estimate failed');
    return evaluatePrice(cents(price), estimate.value, milesTenths(1000));
  }

  it('says NOT CONFIGURED rather than "yes" when no floor exists', () => {
    const check = checkAgainstFloor(optionAt(9_000), NOTHING_CONFIGURED);
    expect(check.status).toBe('NOT_CONFIGURED');
    if (check.status === 'NOT_CONFIGURED') {
      expect(check.settings).toHaveLength(2);
    }
  });

  it('passes a price that clears the floor', () => {
    const check = checkAgainstFloor(optionAt(15_000), {
      minimumContributionCents: 5_000,
      minimumContributionPerMileCents: 50,
      targetMarginBps: null,
    });
    expect(check.status).toBe('MEETS_FLOOR');
  });

  it('fails a price below the contribution floor, and says why', () => {
    const check = checkAgainstFloor(optionAt(10_000), {
      minimumContributionCents: 5_000,
      minimumContributionPerMileCents: null,
      targetMarginBps: null,
    });

    expect(check.status).toBe('BELOW_FLOOR');
    if (check.status === 'BELOW_FLOOR') {
      expect(check.reasons[0]).toContain('below the minimum');
    }
  });

  it('fails a price below the per-mile floor', () => {
    const check = checkAgainstFloor(optionAt(12_000), {
      minimumContributionCents: null,
      minimumContributionPerMileCents: 50,
      targetMarginBps: null,
    });
    expect(check.status).toBe('BELOW_FLOOR');
  });
});

describe('the stored breakdown', () => {
  it('records every line, the basis, and what the price earns', () => {
    const priced = priceJob(inputs(), NOTHING_CONFIGURED);
    if (priced.status !== 'OK') throw new Error('pricing failed');

    const breakdown = buildBreakdown(inputs(), priced.value, cents(15_000));

    expect(breakdown.estimatedCostCents).toBe(8_750);
    expect(breakdown.quotedPriceCents).toBe(15_000);
    expect(breakdown.expectedContributionCents).toBe(6_250);
    expect(breakdown.miles).toBe(100);
    expect(Array.isArray(breakdown.costLines)).toBe(true);
    expect((breakdown.costLines as unknown[]).length).toBe(4);
  });

  it('preserves the NOT CONFIGURED state of the reference prices', () => {
    const priced = priceJob(inputs(), NOTHING_CONFIGURED);
    if (priced.status !== 'OK') throw new Error('pricing failed');

    const breakdown = buildBreakdown(inputs(), priced.value, cents(15_000));
    expect(breakdown.minimumPrice).toMatchObject({ status: 'NOT_CONFIGURED' });
  });
});

describe('quote items and distance', () => {
  it('totals quote lines', () => {
    expect(
      sumQuoteItems([
        { unitPriceCents: 15_000, quantity: 1 },
        { unitPriceCents: 2_500, quantity: 2 },
      ]),
    ).toEqual({ status: 'OK', value: 20_000 });
  });

  it('requires a distance before quoting per mile', () => {
    expect(requireMiles(null).status).toBe('DATA_INCOMPLETE');
    expect(requireMiles(0).status).toBe('NOT_CALCULABLE');
    expect(requireMiles(247)).toEqual({ status: 'OK', value: 247 });
  });
});
