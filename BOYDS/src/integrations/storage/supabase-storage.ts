/**
 * Supabase Storage adapter. The live provider.
 *
 * This is the one integration configured from day one, because it ships with
 * the database.
 */

import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { domainError, err, ok, type Result } from '@/lib/result';
import {
  DOCUMENTS_BUCKET,
  type StorageProvider,
  type StoredFile,
  type UploadRequest,
} from './types';

export function createSupabaseStorage(client: SupabaseClient): StorageProvider {
  return {
    name: 'supabase',
    available: true,

    async upload(request: UploadRequest): Promise<Result<StoredFile>> {
      const { error } = await client.storage
        .from(DOCUMENTS_BUCKET)
        .upload(request.path, request.body, {
          contentType: request.contentType,
          upsert: false,
        });

      if (error) {
        return err(domainError('storage/upload-failed', 'Could not store the file.'));
      }

      const sizeBytes =
        request.body instanceof Blob ? request.body.size : request.body.byteLength;

      return ok({ path: request.path, sizeBytes, contentType: request.contentType });
    },

    async signedUrl(path: string, expiresInSeconds: number): Promise<Result<string>> {
      const { data, error } = await client.storage
        .from(DOCUMENTS_BUCKET)
        .createSignedUrl(path, expiresInSeconds);

      if (error || !data) {
        return err(domainError('storage/sign-failed', 'Could not open that file.'));
      }
      return ok(data.signedUrl);
    },

    async remove(path: string): Promise<Result<void>> {
      const { error } = await client.storage.from(DOCUMENTS_BUCKET).remove([path]);
      if (error) {
        return err(domainError('storage/remove-failed', 'Could not remove the file.'));
      }
      return ok(undefined);
    },
  };
}
