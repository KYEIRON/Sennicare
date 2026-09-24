/**
 * A stand-in for the `server-only` package in unit tests.
 *
 * `server-only` throws on import outside a React Server Component build. It is
 * a build-time guard: its job is to make importing a server module into client
 * code a compile error. That guarantee is unaffected by aliasing it here.
 *
 * The guard test `tests/guards/no-secret-exposure.test.ts` separately asserts
 * that the real import is present in every server module, so removing it from
 * the source would still fail the build.
 */
export {};
