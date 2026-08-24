/**
 * File storage for BOYD'S.
 *
 * All buckets are PRIVATE. A file is never publicly readable: the application
 * issues a short-lived signed URL after checking the caller is entitled to see
 * it. See docs/SECURITY.md.
 */

import type { Result } from '@/lib/result';

export const DOCUMENTS_BUCKET = 'boyds-documents';

/** 25 MB. A phone photo is well under this; a mistake is well over it. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/**
 * What BOYD'S accepts.
 *
 * Deliberately narrow: proof of delivery, photos and receipts. An allow-list
 * rather than a block-list, because the interesting attacks are always the file
 * types nobody thought to block.
 */
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export function isAllowedMimeType(value: string): value is AllowedMimeType {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(value);
}

export interface UploadRequest {
  readonly path: string;
  readonly body: ArrayBuffer | Blob;
  readonly contentType: string;
}

export interface StoredFile {
  readonly path: string;
  readonly sizeBytes: number;
  readonly contentType: string;
}

export interface StorageProvider {
  readonly name: string;
  readonly available: boolean;

  upload(request: UploadRequest): Promise<Result<StoredFile>>;
  /** A URL that expires. Never a permanent public link. */
  signedUrl(path: string, expiresInSeconds: number): Promise<Result<string>>;
  remove(path: string): Promise<Result<void>>;
}

/**
 * Build a storage path for a document.
 *
 * Namespaced by entity and given a random suffix, so a path cannot be guessed
 * from a job number. The bucket is private regardless; this is defence in depth.
 */
export function documentPath(
  entityTable: string,
  entityId: string,
  fileName: string,
): string {
  const safeName = fileName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    // Collapse dot runs. Traversal is already impossible here because a slash
    // cannot survive the line above, but a path containing ".." is the kind of
    // thing that becomes a problem the moment this function is reused somewhere
    // it was not designed for.
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+/, '')
    .slice(-80);

  const suffix = crypto.randomUUID().slice(0, 8);
  return `${entityTable}/${entityId}/${suffix}-${safeName || 'file'}`;
}
