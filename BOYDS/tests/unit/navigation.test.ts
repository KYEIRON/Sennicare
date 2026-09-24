import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isActiveSection } from '@/lib/navigation';

describe('which menu section is active', () => {
  it('matches the section itself and pages inside it', () => {
    expect(isActiveSection('/crm', '/crm')).toBe(true);
    expect(isActiveSection('/customers/abc-123', '/customers')).toBe(true);
  });

  it('does not match a different section', () => {
    // The production bug: on /crm the menu underlined Command Centre.
    expect(isActiveSection('/crm', '/command-centre')).toBe(false);
  });

  it('does not match a section that merely shares a prefix', () => {
    expect(isActiveSection('/customers-archive', '/customers')).toBe(false);
  });
});

describe('the ops menu and clock follow the user around', () => {
  // The ops layout stays mounted across in-app navigation. Anything it
  // computes on the server — a path, a time — freezes at the first page load.
  const read = (file: string) =>
    readFileSync(join(process.cwd(), 'src', 'app', '(ops)', file), 'utf8');

  it('reads the path in the browser, not from the layout', () => {
    const nav = read('nav.tsx');
    expect(nav).toMatch(/^'use client'/);
    expect(nav).toContain('usePathname()');
    expect(read('layout.tsx')).not.toContain('currentPath=');
  });

  it('keeps the header clock ticking', () => {
    const clock = read('live-clock.tsx');
    expect(clock).toMatch(/^'use client'/);
    expect(clock).toContain('setInterval');
  });
});
