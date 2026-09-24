import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { FAQ, SERVICES, SERVICE_AREAS } from '@/features/site/content';

/**
 * A standing guard on what BOYD'S says in public.
 *
 * Business rules 34 to 36: no certification, licence, insurance or compliance
 * claim without a verified record; no superlative without evidence; no implied
 * office where BOYD'S has none.
 *
 * This is not stylistic. A medical courier claiming compliance it does not hold
 * is making a representation a customer may rely on, and BOYD'S would be liable
 * for it. The test exists so that a claim cannot reach the website by someone
 * writing a persuasive sentence on a busy afternoon.
 */

const SITE_SOURCES = [
  join(process.cwd(), 'src/features/site'),
  join(process.cwd(), 'src/app/(site)'),
];

function sourceFiles(dir: string): string[] {
  try {
    return readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) return sourceFiles(full);
      return /\.(ts|tsx)$/.test(entry) ? [full] : [];
    });
  } catch {
    return [];
  }
}

/** Comments explain the rules; only rendered text is checked. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const files = SITE_SOURCES.flatMap(sourceFiles).map((file) => ({
  path: relative(process.cwd(), file),
  content: stripComments(readFileSync(file, 'utf8')),
}));

describe('the public website makes no unverified claim', () => {
  it('finds the website source', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each([
    ['certification', /\b(certified|certification|accredited|accreditation)\b/i],
    ['regulatory compliance', /\b(HIPAA|FDA|DOT.certified|compliant|compliance)\b/i],
    ['licensing', /\b(licen[cs]ed|licence holder|license holder)\b/i],
    ['insurance cover', /\b(fully insured|insured up to|insurance cover(age)?)\b/i],
    ['bonding', /\bbonded\b/i],
  ])('makes no %s claim', (_label, pattern) => {
    const offenders = files.filter((f) => pattern.test(f.content)).map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it.each([
    ['largest', /\b(largest|biggest)\b/i],
    ['fastest', /\bfastest\b/i],
    ['number one', /\b(#1|number one|no\.\s*1)\b/i],
    ['best', /\b(the best|best in|market.leading|industry.leading)\b/i],
    ['cheapest', /\b(cheapest|lowest price|unbeatable)\b/i],
  ])('makes no "%s" claim', (_label, pattern) => {
    const offenders = files.filter((f) => pattern.test(f.content)).map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it('never implies an office or depot BOYD’S does not have', () => {
    const pattern = /\b(our (office|depot|warehouse|branch|facility|location)s?)\b/i;
    const offenders = files.filter((f) => pattern.test(f.content)).map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it('never promises a delivery time it cannot verify', () => {
    // BOYD'S has no GPS, no routing and no availability engine. A guaranteed
    // window would be a promise made by a system that cannot check it.
    const pattern = /\b(guaranteed?|guarantee) (delivery|within|in \d)/i;
    const offenders = files.filter((f) => pattern.test(f.content)).map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it('never claims 24/7 operation', () => {
    // The website accepts requests at any hour. That is not the same as BOYD'S
    // operating around the clock, and the difference matters to a customer.
    const pattern = /\b(24\/7|24-7|around the clock|always open)\b/i;
    const offenders = files.filter((f) => pattern.test(f.content)).map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it('never states a fleet size other than the truth', () => {
    const overstated = /\b(fleet of \d+|our fleet of|\d+ vehicles|multiple vans)\b/i;
    const offenders = files.filter((f) => overstated.test(f.content)).map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it('never quotes a price or a rate', () => {
    // BOYD'S has no configured pricing policy. A published rate would be
    // invented, and a customer could hold BOYD'S to it.
    const pattern = /\$\d|\bper mile\b.*\$|\bflat rate\b|\bstarting (at|from) \$/i;
    const offenders = files.filter((f) => pattern.test(f.content)).map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it('never fabricates a testimonial, review or rating', () => {
    const pattern = /\b(\d(\.\d)? stars?|rated \d|customers say|testimonial)\b/i;
    const offenders = files.filter((f) => pattern.test(f.content)).map((f) => f.path);
    expect(offenders).toEqual([]);
  });
});

describe('the content is complete and coherent', () => {
  it('gives every service a slug, summary and meta description', () => {
    for (const service of SERVICES) {
      expect(service.slug).toMatch(/^[a-z0-9-]+$/);
      expect(service.summary.length).toBeGreaterThan(20);
      expect(service.metaDescription.length).toBeGreaterThan(50);
      expect(service.metaDescription.length).toBeLessThanOrEqual(160);
      expect(service.whatWeDo.length).toBeGreaterThan(0);
    }
  });

  it('gives every service a distinct slug', () => {
    const slugs = SERVICES.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('places every service area in a real state code', () => {
    for (const area of SERVICE_AREAS) {
      expect(area.state).toMatch(/^[A-Z]{2}$/);
      expect(area.slug).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('answers the fleet question honestly', () => {
    const answer = FAQ.find((entry) => entry.question.includes('fleet'))?.answer ?? '';
    expect(answer).toContain('one van');
  });

  it('does not promise a collection time in the FAQ', () => {
    const answer = FAQ.find((entry) => entry.question.includes('quickly'))?.answer ?? '';
    expect(answer).toMatch(/depends|cannot verify|tell you/i);
  });

  it('is clear that a request is not a confirmed booking', () => {
    const answer =
      FAQ.find((entry) => entry.question.includes('outside working hours'))?.answer ?? '';
    expect(answer).toMatch(/not a confirmed booking/i);
  });
});
