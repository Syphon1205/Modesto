# @modesto/openwork-automations

Vendored from [OpenWork](https://github.com/different-ai/openwork)'s
`packages/automations` (MIT). See `THIRD_PARTY_NOTICES.md`.

Kept close to upstream **on purpose**, so upstream fixes stay pullable. Changes
made on vendoring are limited to what the build requires:

- `@openwork/types/automations` inlined as `./types.ts` (that package is not
  vendored; only the automations slice is used).
- `.js` import specifiers rewritten to `.ts`, matching this repo.
- `bun:test` imports rewritten to `vitest` — this repo runs vitest, and
  `bun test` is explicitly not used.

Nothing else is edited. Modesto-specific behavior belongs in the
`AutomationRepository` adapter that implements `ports.ts`, not in here.

## Shape

The entire durable boundary is `AutomationRepository` in `ports.ts`, injected.
`engine-testing.ts` is upstream's in-memory implementation of it, which is what
lets the engine be verified before any Modesto persistence exists.

Claims and revision updates must be transactional — upstream's requirement, and
the part an adapter is most likely to get wrong.
