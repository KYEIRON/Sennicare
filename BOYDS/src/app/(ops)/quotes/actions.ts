'use server';

import { revalidatePath } from 'next/cache';
import { requirePartner } from '@/lib/auth/session';
import { getServerClient } from '@/lib/supabase/server';
import { nextQuoteNumber, pricingPolicyFor } from '@/database/operations';
import { quoteSchema } from '@/validation/crm';
import {
  buildBreakdown,
  checkAgainstFloor,
  estimateCost,
  evaluatePrice,
  priceJob,
  type PricingInputs,
} from '@/services/finance/pricing';
import { cents, milesTenths } from '@/types/branded';
import type { FormState } from '@/app/(ops)/customers/actions';

/**
 * Create a quote.
 *
 * A quote is never invented: it always comes from the pricing engine, and the
 * full breakdown is stored alongside it so the price can be explained later.
 *
 * Where BOYD'S has not recorded the inputs the engine needs — a recent fuel
 * price, the van's real economy, a derived vehicle cost per mile — the estimate
 * is DATA INCOMPLETE. The quote can still be issued at a price the partner
 * chooses, and the breakdown records honestly that the cost behind it was not
 * fully known.
 */
export async function createQuote(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await requirePartner();
  if (!auth.ok) return { error: 'You do not have access to this.' };

  const parsed = quoteSchema.safeParse({
    customerId: formData.get('customerId'),
    leadId: formData.get('leadId') || null,
    jobTypeId: formData.get('jobTypeId'),
    priority: formData.get('priority'),
    collectionSummary: formData.get('collectionSummary'),
    deliverySummary: formData.get('deliverySummary'),
    requestedDate: formData.get('requestedDate'),
    estimatedMiles: formData.get('estimatedMiles'),
    quotedPriceCents: formData.get('quotedPrice'),
    validUntil: formData.get('validUntil'),
    terms: formData.get('terms'),
    overrideReason: formData.get('overrideReason'),
    notes: formData.get('notes'),
  });

  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await getServerClient();
  if (!supabase) return { error: 'The database is not connected.' };

  const policy = await pricingPolicyFor(
    supabase,
    parsed.data.jobTypeId,
    parsed.data.priority,
  );

  // Real recorded inputs only. Anything BOYD'S has not recorded stays null and
  // the engine reports the gap rather than assuming a figure.
  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('fuel_economy_mpg_tenths')
    .eq('active', true)
    .limit(1)
    .maybeSingle();

  const { data: recentFuel } = await supabase
    .from('fuel_transactions')
    .select('price_per_gallon_cents')
    .order('purchased_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const inputs: PricingInputs = {
    miles: milesTenths(parsed.data.estimatedMiles),
    fuelPricePerGallonCents: recentFuel?.price_per_gallon_cents ?? null,
    vehicleMpg: vehicle?.fuel_economy_mpg_tenths ?? null,
    vehicleCostPerMileCents: policy.perMileCents,
    driverLabourBasis: null,
    estimatedHours: null,
    expectedTollsCents: null,
    expectedParkingCents: null,
    otherCostsCents: null,
    urgencyMultiplierBps: policy.urgencyMultiplierBps,
  };

  const priced = priceJob(inputs, policy);
  const estimate = estimateCost(inputs);

  const quotedPrice = cents(parsed.data.quotedPriceCents);

  let expectedContribution: number | null = null;
  let expectedPerMile: number | null = null;
  let belowFloor = false;

  if (estimate.status === 'OK') {
    const option = evaluatePrice(quotedPrice, estimate.value, inputs.miles);
    expectedContribution = option.contribution;
    expectedPerMile =
      option.contributionPerMile.status === 'OK'
        ? option.contributionPerMile.value
        : null;

    const floor = checkAgainstFloor(option, policy);
    belowFloor = floor.status === 'BELOW_FLOOR';

    if (belowFloor && !parsed.data.overrideReason?.trim()) {
      return {
        error: `This price is below the configured minimum. ${
          floor.status === 'BELOW_FLOOR' ? floor.reasons.join(' ') : ''
        } Give a reason to override it.`,
      };
    }
  }

  const breakdown =
    priced.status === 'OK'
      ? buildBreakdown(inputs, priced.value, quotedPrice)
      : {
          calculatedAt: new Date().toISOString(),
          miles: parsed.data.estimatedMiles / 10,
          quotedPriceCents: quotedPrice,
          costEstimate: estimate,
          note: 'The cost estimate could not be completed from recorded data. This price was set by a partner, and what was missing is recorded above.',
        };

  const { error } = await supabase.from('quotes').insert({
    quote_number: await nextQuoteNumber(supabase),
    customer_id: parsed.data.customerId,
    lead_id: parsed.data.leadId,
    job_type_id: parsed.data.jobTypeId,
    priority: parsed.data.priority,
    collection_summary: parsed.data.collectionSummary,
    delivery_summary: parsed.data.deliverySummary,
    requested_date: parsed.data.requestedDate,
    estimated_miles_tenths: parsed.data.estimatedMiles,
    estimated_cost_cents: estimate.status === 'OK' ? estimate.value.total : null,
    recommended_price_cents:
      priced.status === 'OK' && priced.value.targetPrice.status === 'OK'
        ? priced.value.targetPrice.value
        : null,
    quoted_price_cents: quotedPrice,
    expected_contribution_cents: expectedContribution,
    expected_contribution_per_mile_cents: expectedPerMile,
    pricing_breakdown: breakdown,
    below_minimum_override: belowFloor,
    override_reason: belowFloor ? parsed.data.overrideReason : null,
    valid_until: parsed.data.validUntil,
    terms: parsed.data.terms,
    notes: parsed.data.notes,
    created_by: auth.value.id,
    provenance: 'REAL',
  });

  if (error) return { error: 'Could not save the quote.' };

  revalidatePath('/quotes');
  return { success: 'Quote created.' };
}

/** Move a quote through its statuses. */
export async function updateQuoteStatus(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await requirePartner();
  if (!auth.ok) return { error: 'You do not have access to this.' };

  const quoteId = String(formData.get('quoteId') ?? '');
  const status = String(formData.get('status') ?? '');

  const supabase = await getServerClient();
  if (!supabase) return { error: 'The database is not connected.' };

  const { error } = await supabase.from('quotes').update({ status }).eq('id', quoteId);

  // The database refuses to accept an expired quote; surface that plainly.
  if (error) return { error: error.message };

  revalidatePath('/quotes');
  return { success: `Quote marked ${status.toLowerCase()}.` };
}
