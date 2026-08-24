import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Standing guard against secrets reaching the browser.
 *
 * Next.js inlines any environment variable prefixed NEXT_PUBLIC_ into the
 * client bundle. The Supabase service role key bypasses row level security
 * entirely — if it ever reached a browser, every protection in BOYD'S would be
 * void at once. See docs/SECURITY.md.
 */

const SRC = join(process.cwd(), 'src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry) ? [full] : [];
  });
}

const files = sourceFiles(SRC).map((file) => ({
  path: relative(process.cwd(), file),
  content: readFileSync(file, 'utf8'),
}));

describe('secrets never reach the browser', () => {
  it('never prefixes the service role key with NEXT_PUBLIC_', () => {
    const offenders = files
      .filter((f) => /NEXT_PUBLIC_[A-Z_]*SERVICE_ROLE/.test(f.content))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it('never reads the service role key in a client component', () => {
    const offenders = files
      .filter(
        (f) =>
          /^['"]use client['"]/m.test(f.content) &&
          f.content.includes('SUPABASE_SERVICE_ROLE_KEY'),
      )
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it('keeps the authorisation guards server-only', () => {
    const session = files.find((f) => f.path.endsWith('lib/auth/session.ts'));
    expect(session).toBeDefined();
    // The `server-only` import makes importing this from a client component a
    // build error rather than a silent security hole.
    expect(session!.content).toContain("import 'server-only'");
  });

  it('keeps repositories server-only', () => {
    const repositories = files.filter((f) => f.path.includes('src/database/'));
    expect(repositories.length).toBeGreaterThan(0);
    for (const repository of repositories) {
      expect(repository.content).toContain("import 'server-only'");
    }
  });

  it('contains no hardcoded credential-shaped literals', () => {
    // JWTs (Supabase keys) start with the base64 of {"alg":.
    const jwtLike = /eyJ[A-Za-z0-9_-]{20,}/;
    const offenders = files.filter((f) => jwtLike.test(f.content)).map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it('never disables TLS verification', () => {
    const offenders = files
      .filter((f) =>
        /NODE_TLS_REJECT_UNAUTHORIZED|rejectUnauthorized:\s*false/.test(f.content),
      )
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });
});

describe('authorisation is not left to the interface', () => {
  it('guards both protected route groups in their layout, not per page', () => {
    const opsLayout = files.find((f) => f.path.includes('(ops)/layout.tsx'));
    const driverLayout = files.find((f) => f.path.includes('(driver)/layout.tsx'));

    expect(opsLayout?.content).toContain('requirePartner');
    expect(driverLayout?.content).toContain('requireDriver');
  });

  it('never statically prerenders a protected area', () => {
    // A cached copy of a signed-in partner's page could be served to someone
    // else. Protected routes are evaluated per request, against the session.
    for (const path of ['(ops)/layout.tsx', '(driver)/layout.tsx']) {
      const layout = files.find((f) => f.path.includes(path));
      expect(layout?.content).toContain("export const dynamic = 'force-dynamic'");
    }
  });

  it('does not guard a protected area with a client-side check', () => {
    const layouts = files.filter(
      (f) => f.path.includes('(ops)/') || f.path.includes('(driver)/'),
    );
    for (const layout of layouts) {
      if (layout.path.endsWith('layout.tsx')) {
        expect(layout.content).not.toMatch(/^['"]use client['"]/m);
      }
    }
  });
});
