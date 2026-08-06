# Isolation Anomaly

**[andifathulms.github.io/isolation-anomaly](https://andifathulms.github.io/isolation-anomaly/)**

**Interleave two transactions by hand, watch the anomaly happen, then switch database engine and isolation level and watch the same schedule behave completely differently.**

Hand-built transaction schedules executed against modelled database engines, with anomalies named and cited, and the same schedule compared across engines and isolation levels. Static site, no backend.

This models **documented behaviour for a fixed operation set at specific engine versions**. It is not a database. Cases outside the modelled set are refused rather than approximated, and every engine claim links to the vendor documentation behind it.

> Previously named *Sekat* (Indonesian: a partition, a divider) in `PRD.md`. The slug is now `isolation-anomaly`.

## What is here

Start with [the on-call roster emptying at REPEATABLE READ](https://andifathulms.github.io/isolation-anomaly/en/schedule/#s=write-skew&p=postgres-16&l=RR&i=5) — two doctors, each checking that the other is on call, both going off call, both committing. Then switch the level to SERIALIZABLE and watch the same schedule get refused, or switch the engine to MySQL and watch it deadlock instead.

Ten scenarios, each with the framing that makes the stakes obvious, executed against four engine packs at every isolation level. Six pages: an overview, the score with stepping and state panels, the scenario library, the cross-engine matrix, the conflict graph, and the engine packs with every citation printed beside the rule it justifies.

## Why

Write skew is the point. Two transactions read the same data, each verify a constraint, each write a *different* row, and both commit. Nothing conflicted, and the constraint is violated by the combination. It is absent from the ANSI anomaly list, permitted by snapshot isolation, and it is the anomaly most likely to hurt a real application.

And the level names mean different things in different engines. PostgreSQL's `REPEATABLE READ` is snapshot isolation. PostgreSQL's `READ UNCOMMITTED` is `READ COMMITTED`. Oracle's `SERIALIZABLE` is snapshot isolation. None of that is derivable from general MVCC knowledge — it is read from vendor documentation, cited in an engine pack, and verified against the running engine.

## What the engines actually disagree about

Recorded against PostgreSQL 16.14, MySQL 8.4.11, SQL Server 16.0.4265.3 and Oracle 23.26.2.0.0 — in containers, committed as 150 fixtures:

| | PostgreSQL 16 | MySQL 8.4 InnoDB | SQL Server 2022 | Oracle 23ai |
|---|---|---|---|---|
| Levels it really has | 3 | 4 | 5 | **2** |
| Default | `READ COMMITTED` | `REPEATABLE READ` | `READ COMMITTED` | `READ COMMITTED` |
| `READ UNCOMMITTED` | accepts the name, gives you `READ COMMITTED` | real dirty read | real dirty read | **no such level** |
| `REPEATABLE READ` | snapshot isolation, no phantoms | snapshot for plain reads only | ANSI's: locks, **phantoms possible** | **no such level** |
| `SNAPSHOT` | no such level | no such level | the real thing | no such level — and yet it is what `SERIALIZABLE` gives you |
| **Write skew is permitted at** | `REPEATABLE READ` | `REPEATABLE READ` | `SNAPSHOT` | **`SERIALIZABLE`** |
| Write skew is caught by | `SERIALIZABLE`, aborting with `40001` | nothing — it deadlocks | nothing — it deadlocks | **nothing at all** |

One schedule — two doctors, each checking the other is on call, each going off call — commits on Oracle at the level named `SERIALIZABLE`, with no error raised. The same schedule is aborted by PostgreSQL at the same level name. Nothing about that is derivable from the word.

Where the model will not answer: SQL Server picks its deadlock victim by internal cost estimate, and the same schedule loses T1 at `REPEATABLE READ` and T2 at `SERIALIZABLE`. No rule over waiting order reproduces that, so those runs are **refused** with the gap named rather than guessed. Five of the 150 recorded runs are refused, and the test suite checks each refusal is justified by a deadlock in the recording.

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
