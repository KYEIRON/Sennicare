import { describe, expect, it } from 'vitest';
import {
  decodeSignature,
  expenseSchema,
  fuelSchema,
  signatureSchema,
  uploadSchema,
} from '@/validation/field-records';
import { MAX_UPLOAD_BYTES } from '@/integrations/storage/types';
import { documentPath, isAllowedMimeType } from '@/integrations/storage/types';

describe('expense validation', () => {
  it('accepts an amount typed as a person would type it', () => {
    for (const input of ['41.38', '$41.38', ' 41.38 ', 41.38]) {
      const result = expenseSchema.safeParse({ category: 'PARKING', amountCents: input });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.amountCents).toBe(4138);
    }
  });

  it('rejects a blank amount rather than recording zero', () => {
    const result = expenseSchema.safeParse({ category: 'PARKING', amountCents: '' });
    expect(result.success).toBe(false);
  });

  it('rejects zero and negative amounts', () => {
    for (const input of ['0', '0.00']) {
      expect(
        expenseSchema.safeParse({ category: 'TOLL', amountCents: input }).success,
      ).toBe(false);
    }
  });

  it('rejects a malformed amount rather than guessing at it', () => {
    for (const input of ['forty', '12,34.5', '1.234', '--5']) {
      expect(
        expenseSchema.safeParse({ category: 'TOLL', amountCents: input }).success,
      ).toBe(false);
    }
  });

  it('rejects an unknown category', () => {
    expect(
      expenseSchema.safeParse({ category: 'BRIBE', amountCents: '10.00' }).success,
    ).toBe(false);
  });
});

describe('fuel validation', () => {
  const valid = {
    vehicleId: '00000000-0000-4000-8000-000000000001',
    gallonsThousandths: '11.063',
    pricePerGallonCents: '3.74',
    totalCostCents: '41.38',
    odometerTenths: '834120.0',
    station: 'Test station',
  };

  it('accepts a complete entry', () => {
    const result = fuelSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.gallonsThousandths).toBe(11063);
      expect(result.data.pricePerGallonCents).toBe(374);
      expect(result.data.totalCostCents).toBe(4138);
      expect(result.data.odometerTenths).toBe(8341200);
    }
  });

  it('records the receipt total, never a figure derived from the other two', () => {
    // Pumps round, and receipts carry taxes and fees. BOYD'S records what was
    // actually paid, so the total is taken from the receipt even when it does
    // not equal gallons times price per gallon.
    const result = fuelSchema.safeParse({ ...valid, totalCostCents: '43.10' });
    expect(result.success).toBe(true);

    if (result.success) {
      const derived = Math.round(
        (result.data.gallonsThousandths / 1000) * result.data.pricePerGallonCents,
      );
      expect(derived).toBe(4138);
      expect(result.data.totalCostCents).toBe(4310);
    }
  });

  it('requires gallons, price and total', () => {
    for (const field of ['gallonsThousandths', 'pricePerGallonCents', 'totalCostCents']) {
      expect(fuelSchema.safeParse({ ...valid, [field]: '' }).success).toBe(false);
    }
  });

  it('treats a blank odometer as not recorded', () => {
    const result = fuelSchema.safeParse({ ...valid, odometerTenths: '' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.odometerTenths).toBeNull();
  });
});

describe('upload validation', () => {
  it('accepts a phone photo', () => {
    expect(
      uploadSchema.safeParse({
        fileName: 'IMG_0042.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 2_400_000,
      }).success,
    ).toBe(true);
  });

  it('rejects a file type that is not on the allow-list', () => {
    for (const mimeType of ['text/html', 'application/javascript', 'image/svg+xml']) {
      expect(
        uploadSchema.safeParse({ fileName: 'x', mimeType, sizeBytes: 100 }).success,
      ).toBe(false);
    }
  });

  it('rejects an empty or oversized file', () => {
    expect(
      uploadSchema.safeParse({ fileName: 'x.jpg', mimeType: 'image/jpeg', sizeBytes: 0 })
        .success,
    ).toBe(false);
    expect(
      uploadSchema.safeParse({
        fileName: 'x.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: MAX_UPLOAD_BYTES + 1,
      }).success,
    ).toBe(false);
  });

  it('knows which types are allowed', () => {
    expect(isAllowedMimeType('image/jpeg')).toBe(true);
    expect(isAllowedMimeType('image/svg+xml')).toBe(false);
  });
});

describe('storage paths', () => {
  it('namespaces by entity and cannot be guessed from the job number', () => {
    const path = documentPath('jobs', 'abc-123', 'photo.jpg');
    expect(path.startsWith('jobs/abc-123/')).toBe(true);
    expect(path).not.toBe('jobs/abc-123/photo.jpg');
  });

  it('strips characters that do not belong in a path', () => {
    const path = documentPath('jobs', 'abc', '../../etc/passwd');
    expect(path).not.toContain('..');
    expect(path).not.toContain('/etc/');
  });

  it('produces a different path each time, so an upload cannot clobber another', () => {
    const a = documentPath('jobs', 'abc', 'photo.jpg');
    const b = documentPath('jobs', 'abc', 'photo.jpg');
    expect(a).not.toBe(b);
  });
});

describe('signature capture', () => {
  const tinyPng =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  it('accepts a signature with the signer’s name', () => {
    const result = signatureSchema.safeParse({
      jobId: '00000000-0000-4000-8000-000000000001',
      signedByName: 'Name as given by the recipient',
      imageData: tinyPng,
    });
    expect(result.success).toBe(true);
  });

  it('requires a name — a signature with nobody attached proves nothing', () => {
    expect(
      signatureSchema.safeParse({
        jobId: '00000000-0000-4000-8000-000000000001',
        signedByName: '   ',
        imageData: tinyPng,
      }).success,
    ).toBe(false);
  });

  it('rejects anything that is not a PNG data URL', () => {
    for (const imageData of ['', 'not-a-url', 'data:text/html;base64,PHN2Zz4=']) {
      expect(
        signatureSchema.safeParse({
          jobId: '00000000-0000-4000-8000-000000000001',
          signedByName: 'A name',
          imageData,
        }).success,
      ).toBe(false);
    }
  });

  it('decodes a valid signature', () => {
    const decoded = decodeSignature(tinyPng);
    expect(decoded).not.toBeNull();
    expect(decoded!.byteLength).toBeGreaterThan(0);
  });

  it('returns null for something it cannot decode', () => {
    expect(decodeSignature('data:image/png;base64,')).toBeNull();
  });
});
