import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

const alias = {
  '@': resolve(import.meta.dirname, './src'),
  // `server-only` throws on import outside a React Server Component build. It
  // is a build-time guard, so a stub here changes nothing about what it
  // guarantees — and a guard test asserts the real import is still present.
  'server-only': resolve(import.meta.dirname, './tests/stubs/server-only.ts'),
};

export default defineConfig({
  test: {
    projects: [
      {
        // Pure domain logic and standing guards. No database, no network.
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/unit/**/*.test.ts', 'tests/guards/**/*.test.ts'],
        },
        resolve: { alias },
      },
      {
        // Row level security against real PostgreSQL with the real migrations.
        // These do NOT skip when the database is missing — they fail with
        // instructions, because a silent skip would report success while
        // proving nothing about BOYD'S authorisation boundary.
        test: {
          name: 'integration',
          environment: 'node',
          include: ['tests/integration/**/*.test.ts'],
          fileParallelism: false,
        },
        resolve: { alias },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/services/**', 'src/validation/**'],
      reporter: ['text', 'html'],
    },
  },
});
