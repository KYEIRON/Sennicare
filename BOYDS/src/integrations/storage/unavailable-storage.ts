/**
 * The unavailable storage adapter.
 *
 * Selected when no database is configured. Every operation returns an explicit
 * failure so the interface can say the capability is not connected. It never
 * pretends a file was saved.
 */

import { domainError, err, type Result } from '@/lib/result';
import type { StorageProvider, StoredFile } from './types';

const UNAVAILABLE = domainError(
  'storage/unavailable',
  'File storage is not connected. Nothing was saved.',
);

export const unavailableStorage: StorageProvider = {
  name: 'unavailable',
  available: false,

  async upload(): Promise<Result<StoredFile>> {
    return err(UNAVAILABLE);
  },
  async signedUrl(): Promise<Result<string>> {
    return err(UNAVAILABLE);
  },
  async remove(): Promise<Result<void>> {
    return err(UNAVAILABLE);
  },
};
