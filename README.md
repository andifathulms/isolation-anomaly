# Isolation Anomaly

**Interleave two transactions by hand, watch the anomaly happen, then switch database engine and isolation level and watch the same schedule behave completely differently.**

Hand-built transaction schedules executed against modelled database engines, with anomalies named and cited, and the same schedule compared across engines and isolation levels. Static site, no backend.

This models **documented behaviour for a fixed operation set at specific engine versions**. It is not a database. Cases outside the modelled set are refused rather than approximated, and every engine claim links to the vendor documentation behind it.

> Previously named *Sekat* (Indonesian: a partition, a divider) in `PRD.md`. The slug is now `isolation-anomaly`.

## Why

Write skew is the point. Two transactions read the same data, each verify a constraint, each write a *different* row, and both commit. Nothing conflicted, and the constraint is violated by the combination. It is absent from the ANSI anomaly list, permitted by snapshot isolation, and it is the anomaly most likely to hurt a real application.

And the level names mean different things in different engines. PostgreSQL's `REPEATABLE READ` is snapshot isolation. PostgreSQL's `READ UNCOMMITTED` is `READ COMMITTED`. Oracle's `SERIALIZABLE` is snapshot isolation. None of that is derivable from general MVCC knowledge — it is read from vendor documentation, cited in an engine pack, and verified against the running engine.

## Language

English is the default locale; Indonesian is available at `/id/`. Database terminology stays in English in both — you will meet `dirty read`, `snapshot`, `gap lock`, and `serializable` in that form in the documentation and in error messages.

## Stack

Next.js 14 App Router with `output: 'export'`, TypeScript `strict`, Tailwind, Zod for pack validation, Vitest. Docker Compose for the oracle harness, **development only**. No database library, SQL parser, or graph library ships in the bundle.

## Commands

```bash
pnpm dev
pnpm build                  # static export to ./out; runs packs:validate first
pnpm preview                # serve ./out under the production basePath
pnpm test                   # vitest watch
pnpm test:run               # vitest once — before every commit
pnpm test:oracle            # simulator vs recorded real-database fixtures
pnpm test:anomalies         # both-direction detection across the library
pnpm test:serial            # conflict graph vs brute-force serializability
pnpm packs:validate         # schema, citations, level-alias declarations
pnpm oracle:record          # DEV ONLY — runs real engines in containers
pnpm typecheck
pnpm lint
```

`pnpm oracle:record` starts containers and executes schedules against real engines. It never runs in CI, never ships in the bundle, and its output is committed as fixtures under `tests/oracle/`.

## Verification

Real databases are the oracle. When the simulator disagrees with a recorded fixture, the simulator is wrong. Anomaly detection is asserted in both directions — the anomaly must appear at levels that permit it and must not appear at levels that prevent it — and conflict-graph cycle detection is cross-checked against brute-force serializability on small schedules.

## Documents

- [`PRD.md`](PRD.md) — scope, binding.
- [`CLAUDE.md`](CLAUDE.md) — how to work in this repository.

## Licence

MIT.
