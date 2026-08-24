import { describe, expect, it } from 'vitest';
import {
  calculateContribution,
  calculateContributionMargin,
  calculateContributionPerMile,
  calculateEmptyMileage,
  calculateTotalCost,
  costInputsFromRow,
  costLine,
  missingCost,
  readCostLine,
  validateMileageSplit,
  type JobCostInputs,
} from '@/services/finance/job-costs';
import { cents, milesTenths } from '@/types/branded';
import { formatCalculation, formatCents } from '@/lib/format';

/** A complete, fully-actual job: $300 revenue against a $240 cost stack. */
function completeJob(): JobCostInputs {
  return {
    revenue: cents(30_000),
    actualMiles: milesTenths(247),
    loadedMiles: milesTenths(190),
    emptyMiles: milesTenths(57),
    costs: {
      fuel_cost: costLine(null, 8_000),
      driver_cost: costLine(null, 7_000),
      vehicle_cost: costLine(null, 4_000),
      toll_cost: costLine(null, 2_000),
      parking_cost: costLine(null, 1_000),
      other_cost: costLine(null, 2_000),
    },
  };
}

describe('estimate and actual are never mixed', () => {
  it('reads an actual as ACTUAL', () => {
    expect(costLine(5_000, 6_300).state).toBe('ACTUAL');
  });

  it('reads an estimate-only line as ESTIMATED', () => {
    expect(costLine(5_000, null).state).toBe('ESTIMATED');
  });

  it('reads an empty line as MISSING', () => {
    expect(costLine(null, null).state).toBe('MISSING');
  });

  it('keeps BOTH figures when an actual arrives', () => {
    // An estimate must never be overwritten: the variance is the data that
    // tells BOYD'S whether its estimating is any good.
    const line = costLine(5_500, 6_300);
    expect(line.estimated).toBe(5_500);
    expect(line.actual).toBe(6_300);
  });

  it('refuses an estimate on the ACTUAL basis', () => {
    const result = readCostLine('fuel_cost', costLine(5_500, null), 'ACTUAL');
    expect(result.status).toBe('DATA_INCOMPLETE');
    if (result.status === 'DATA_INCOMPLETE') {
      expect(result.missing).toEqual(['fuel_cost (actual)']);
    }
  });

  it('accepts an estimate on BEST_AVAILABLE, and says it did', () => {
    const result = readCostLine('fuel_cost', costLine(5_500, null), 'BEST_AVAILABLE');
    expect(result.status).toBe('OK');
    if (result.status === 'OK') {
      expect(result.value).toBe(5_500);
      expect(result.usedEstimates).toEqual(['fuel_cost']);
    }
  });

  it('prefers the actual over the estimate on BEST_AVAILABLE, with no estimate flag', () => {
    const result = readCostLine('fuel_cost', costLine(5_500, 6_300), 'BEST_AVAILABLE');
    expect(result).toEqual({ status: 'OK', value: 6_300 });
  });

  it('reports MISSING as missing on EITHER basis', () => {
    expect(readCostLine('fuel_cost', missingCost(), 'ACTUAL').status).toBe(
      'DATA_INCOMPLETE',
    );
    expect(readCostLine('fuel_cost', missingCost(), 'BEST_AVAILABLE').status).toBe(
      'DATA_INCOMPLETE',
    );
  });
});

describe('contribution on a complete job', () => {
  const job = completeJob();

  it('totals the cost stack to $240.00', () => {
    const result = calculateTotalCost(job, 'ACTUAL');
    expect(result.status).toBe('OK');
    if (result.status === 'OK') {
      expect(result.value.total).toBe(24_000);
      expect(result.value.labourTreatment).toBe('LABOUR_COSTED');
    }
  });

  it('reports $60.00 contribution and never $300 profit', () => {
    const result = calculateContribution(job, 'ACTUAL');
    expect(result.status).toBe('OK');
    if (result.status === 'OK') {
      expect(result.value.contribution).toBe(6_000);
      expect(result.value.contribution).not.toBe(result.value.revenue);
      expect(formatCents(result.value.contribution)).not.toBe('$300.00');
    }
  });

  it('reports a 20.00% margin', () => {
    expect(calculateContributionMargin(job, 'ACTUAL')).toEqual({
      status: 'OK',
      value: 2000,
    });
  });

  it('reports contribution per mile across 24.7 miles', () => {
    expect(calculateContributionPerMile(job, 'ACTUAL')).toEqual({
      status: 'OK',
      value: 243,
    });
  });

  it('reports empty mileage as a share of the total', () => {
    // 5.7 empty of 24.7 total = 23.08%
    expect(calculateEmptyMileage(job)).toEqual({ status: 'OK', value: 2308 });
  });
});

describe('a missing cost is never zero', () => {
  const job: JobCostInputs = {
    ...completeJob(),
    costs: { ...completeJob().costs, fuel_cost: missingCost() },
  };

  it('refuses to total the cost stack', () => {
    const result = calculateTotalCost(job, 'ACTUAL');
    expect(result.status).toBe('DATA_INCOMPLETE');
    if (result.status === 'DATA_INCOMPLETE')
      expect(result.missing).toEqual(['fuel_cost']);
  });

  it('refuses to report a contribution', () => {
    const result = calculateContribution(job, 'ACTUAL');
    expect(result.status).toBe('DATA_INCOMPLETE');
    expect(result).not.toHaveProperty('value');
  });

  it('does NOT report the $220 that treating fuel as zero would produce', () => {
    const result = calculateContribution(job, 'ACTUAL');
    expect(JSON.stringify(result)).not.toContain('22000');
    expect(JSON.stringify(result)).not.toContain('16000');
  });

  it('displays DATA INCOMPLETE rather than a figure', () => {
    const result = calculateContribution(job, 'ACTUAL');
    const shown = formatCalculation(result, (v) => formatCents(v.contribution));
    expect(shown.text).toBe('DATA INCOMPLETE');
    expect(shown.detail).toBe('Missing: fuel_cost');
  });

  it('refuses contribution per mile and margin too', () => {
    expect(calculateContributionPerMile(job, 'ACTUAL').status).toBe('DATA_INCOMPLETE');
    expect(calculateContributionMargin(job, 'ACTUAL').status).toBe('DATA_INCOMPLETE');
  });

  it('names EVERY missing cost, not just the first', () => {
    const bare: JobCostInputs = {
      ...completeJob(),
      costs: {
        fuel_cost: missingCost(),
        driver_cost: missingCost(),
        vehicle_cost: costLine(null, 4_000),
        toll_cost: missingCost(),
        parking_cost: costLine(null, 1_000),
        other_cost: costLine(null, 2_000),
      },
    };
    const result = calculateTotalCost(bare, 'ACTUAL');
    if (result.status === 'DATA_INCOMPLETE') {
      expect(result.missing).toEqual(['fuel_cost', 'driver_cost', 'toll_cost']);
    }
  });
});

describe('no revenue', () => {
  it('reports the missing price rather than a contribution of minus the costs', () => {
    const job: JobCostInputs = { ...completeJob(), revenue: null };
    const result = calculateContribution(job, 'ACTUAL');
    expect(result.status).toBe('DATA_INCOMPLETE');
    if (result.status === 'DATA_INCOMPLETE')
      expect(result.missing).toEqual(['won_price']);
  });
});

describe('driver labour treatment', () => {
  it('labels a contribution computed without labour cost', () => {
    const job = completeJob();
    const result = calculateContribution(job, 'ACTUAL', { excludeDriverLabour: true });
    expect(result.status).toBe('OK');
    if (result.status === 'OK') {
      expect(result.value.labourTreatment).toBe('BEFORE_LABOUR_COST');
      // $240 stack less the $70 driver cost = $170, so contribution is $130.
      expect(result.value.contribution).toBe(13_000);
    }
  });

  it('can still produce a figure when driver cost is MISSING but excluded', () => {
    // Excluding labour is a management choice; it does not require the cost to
    // be known. This is NOT the same as treating the cost as zero — the result
    // says BEFORE_LABOUR_COST.
    const job: JobCostInputs = {
      ...completeJob(),
      costs: { ...completeJob().costs, driver_cost: missingCost() },
    };
    const result = calculateContribution(job, 'ACTUAL', { excludeDriverLabour: true });
    expect(result.status).toBe('OK');
    if (result.status === 'OK')
      expect(result.value.labourTreatment).toBe('BEFORE_LABOUR_COST');
  });

  it('reports DATA INCOMPLETE when labour is INCLUDED but missing', () => {
    const job: JobCostInputs = {
      ...completeJob(),
      costs: { ...completeJob().costs, driver_cost: missingCost() },
    };
    expect(calculateContribution(job, 'ACTUAL').status).toBe('DATA_INCOMPLETE');
  });
});

describe('a loss-making job', () => {
  it('reports a real negative contribution', () => {
    const job: JobCostInputs = { ...completeJob(), revenue: cents(15_000) };
    const result = calculateContribution(job, 'ACTUAL');
    if (result.status === 'OK') {
      expect(result.value.contribution).toBe(-9_000);
      expect(formatCents(result.value.contribution)).toBe('-$90.00');
    }
  });
});

describe('estimates carry through to the result', () => {
  it('tags a contribution built on estimates', () => {
    const job: JobCostInputs = {
      ...completeJob(),
      costs: {
        ...completeJob().costs,
        fuel_cost: costLine(8_500, null),
        toll_cost: costLine(2_500, null),
      },
    };
    const result = calculateContribution(job, 'BEST_AVAILABLE');
    expect(result.status).toBe('OK');
    if (result.status === 'OK') {
      expect(result.usedEstimates).toEqual(['fuel_cost', 'toll_cost']);
    }

    const shown = formatCalculation(result, (v) => formatCents(v.contribution));
    expect(shown.needsBadge).toBe(true);
    expect(shown.detail).toContain('ESTIMATE');
  });
});

describe('mileage split', () => {
  it('accepts loaded + empty = total', () => {
    expect(
      validateMileageSplit(milesTenths(190), milesTenths(57), milesTenths(247)),
    ).toEqual({ status: 'OK', value: 247 });
  });

  it('rejects a split that does not account for the total', () => {
    const result = validateMileageSplit(
      milesTenths(190),
      milesTenths(50),
      milesTenths(247),
    );
    expect(result.status).toBe('NOT_CALCULABLE');
  });

  it('reports which mileage figures are missing', () => {
    const result = validateMileageSplit(null, milesTenths(57), null);
    if (result.status === 'DATA_INCOMPLETE') {
      expect(result.missing).toEqual(['loaded_miles', 'actual_miles']);
    }
  });

  it('refuses empty mileage percentage without the figures', () => {
    const job: JobCostInputs = { ...completeJob(), emptyMiles: null };
    expect(calculateEmptyMileage(job).status).toBe('DATA_INCOMPLETE');
  });

  it('refuses contribution per mile with no actual mileage', () => {
    const job: JobCostInputs = { ...completeJob(), actualMiles: null };
    const result = calculateContributionPerMile(job, 'ACTUAL');
    expect(result.status).toBe('DATA_INCOMPLETE');
  });
});

describe('reading a stored job row', () => {
  it('assembles inputs with the same state rules as the database', () => {
    const inputs = costInputsFromRow({
      won_price_cents: 30_000,
      actual_miles_tenths: 247,
      loaded_miles_tenths: 190,
      empty_miles_tenths: 57,
      fuel_cost_estimated_cents: 8_500,
      fuel_cost_actual_cents: 8_000,
      driver_cost_estimated_cents: null,
      driver_cost_actual_cents: 7_000,
      vehicle_cost_estimated_cents: 4_000,
      vehicle_cost_actual_cents: null,
      toll_cost_estimated_cents: null,
      toll_cost_actual_cents: null,
      parking_cost_estimated_cents: null,
      parking_cost_actual_cents: 1_000,
      other_cost_estimated_cents: null,
      other_cost_actual_cents: 2_000,
    });

    expect(inputs.costs.fuel_cost.state).toBe('ACTUAL');
    expect(inputs.costs.vehicle_cost.state).toBe('ESTIMATED');
    expect(inputs.costs.toll_cost.state).toBe('MISSING');
    expect(calculateContribution(inputs, 'ACTUAL').status).toBe('DATA_INCOMPLETE');
  });
});
