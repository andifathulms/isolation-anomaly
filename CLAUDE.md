# CLAUDE.md — Sekat

Isolation level anomaly explorer. Hand-built transaction schedules executed against modelled database engines, with anomalies named and the same schedule compared across engines and levels. Static site, GitHub Pages, no backend.

Read `PRD.md` before starting any task. It fixes scope; this file describes how to work in the repo.

**Three things shape everything:**

1. **This teaches database behaviour, so wrongness is expensive.** A developer will make a real isolation-level decision based on what this shows. Real databases are the oracle, and they gate the launch.
2. **Never infer a vendor behaviour from general MVCC knowledge.** PostgreSQL's REPEATABLE READ is snapshot isolation. Oracle's SERIALIZABLE is snapshot isolation. PostgreSQL's READ UNCOMMITTED is READ COMMITTED. MySQL InnoDB's locking and non-locking reads disagree *within one transaction*. None of this is derivable — it is read from documentation, cited, and verified against the running engine.
3. **Write skew is the point.** It is absent from the ANSI list, permitted by snapshot isolation, and the anomaly most likely to hurt a real application. Do not treat it as one item among seven.

---

## Stack

- Next.js 14, App Router, `output: 'export'` — static only
- TypeScript, `strict: true`
- Tailwind CSS
- Zod for engine-pack schema validation
- Vitest
- pnpm
- Docker Compose for the oracle harness — **development only**
- No database library, no SQL parser, no graph library.

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
pnpm oracle:record          # DEV ONLY — runs real Postgres/MySQL/SQL Server in containers
pnpm typecheck
pnpm lint
```

`pnpm oracle:record` starts containers and executes schedules against real engines. It never runs in CI, never ships in the bundle, and its output is committed as fixtures.

## Layout

```
app/
  [locale]/                 # id (default), en
    jadwal/                 # schedule editor + score + stepping
    matriks/                # cross-engine comparison
    graf/                   # conflict graph
    skenario/               # scenario library
    mesin/                  # engine packs + citations
components/
  score/                    # staves, bar lines, operation marks, conductor's mark
  versions/                 # version chain panel
  locks/                    # lock table panel
  matrix/
  graph/
lib/
  schedule/                 # schedule model, operation vocabulary
  engine/                   # THE CORE. Pure. No React, no DOM, no clock.
    execute.ts              # the ONE executor, parameterised by pack
    mvcc.ts                 # version chains, visibility
    locks.ts                # lock manager, conflict matrix
    trace.ts                # ExecutionTrace types
    refuse.ts               # structured refusals for unmodelled cases
  detect/                   # INDEPENDENT anomaly detector. No imports from lib/engine.
  serial/                   # conflict graph, cycle detection, brute-force checker
  packs/                    # schema, loader, validator
data/
  packs/                    # postgres.json, mysql.json, sqlserver.json
  scenarios/                # schedules + documented anomaly + permitting levels
tests/
  oracle/                   # recorded real-database fixtures
  anomalies/
  serial/
```

## Invariants

1. **`lib/engine` is pure and deterministic.** `(schedule, pack, level) → ExecutionTrace`. No clock, no randomness, no DOM, no React, no module-level mutable state. Byte-identical trace for identical inputs.

2. **One executor, parameterised by packs.** No `if (engine === 'postgres')`, no per-engine execute function, no engine name reaching the MVCC or lock code. Engines differ in their *rules*, not their machinery — and the comparison matrix is only meaningful if the machinery is shared.

3. **Every pack rule carries a vendor citation and an engine version.** Validator-enforced; the build fails without one. If you cannot cite it, you do not know it — say so rather than adding it.

4. **Level aliases are declared explicitly.** A pack states that PostgreSQL's READ UNCOMMITTED is an alias for READ COMMITTED, and that its REPEATABLE READ is snapshot isolation. Never silently implement the alias; the alias *is* the lesson.

5. **`lib/detect` imports nothing from `lib/engine` except types.** It evaluates each anomaly from its published definition over the trace. A detector sharing the executor's assumptions validates its own bugs.

6. **Refuse rather than approximate.** An operation, level, or engine feature outside the modelled set returns a structured refusal naming the gap. Never guess at vendor behaviour, never fall back to "closest" semantics.

7. **Range reads and inserts are first-class.** Phantoms and gap locks are where engines diverge most; a model without predicate reads teaches the wrong thing.

8. **Anomaly detection is tested in both directions.** Each scenario must produce its anomaly at permitting levels and *not* at preventing levels. One-directional tests pass a detector that always fires.

9. **The oracle harness is development-only.** Docker, containers, and database drivers never appear in `package.json` dependencies for the browser build, never in CI, never in the bundle.

10. **Oracle fixtures record the engine version and the date.** Vendor behaviour changes across versions; a fixture without a version is not evidence.

11. **Conductor's red is reserved for anomalies and aborts.** Nothing else in the app is red — not errors, not locks, not rollbacks that were expected. See PRD §8.

12. **Transaction identity is never colour alone.** Voices carry a pattern or marker as well as a hue.

13. **Nothing is computed in a component.** Components render an `ExecutionTrace`, a matrix result, or a graph.

## Working style

- **Build the oracle harness before the executor.** M0 exists for this. A simulator with no oracle is an opinion about how databases work.
- **Record the fixture, then implement.** Run the schedule against the real engine, commit what it did, then make the simulator match.
- **When the simulator disagrees with the oracle, the simulator is wrong.** Investigate in that order. Do not adjust the fixture.
- **Read the vendor documentation for every rule.** Cite the page in the pack and in the comment. This is the one project where "I know how MVCC works" is actively dangerous.
- **Ship PostgreSQL alone if needed.** Three packs is real research. M3 with one engine is a complete tool; additional packs are additive releases.
- **Small increments.** One anomaly, detected in both directions, with its oracle fixture.
- **Don't touch `next.config.js`, the Actions workflow, the validator, or `oracle:record` without saying so explicitly.**
- **Don't add a database, SQL-parsing, or graph-layout dependency.**
- **Never weaken a test to make something pass**, especially in `tests/oracle/`.

## Conventions

- Named exports; defaults only where Next requires them.
- Discriminated unions for operations, trace steps, anomalies, and refusals, keyed on `type`. Exhaustive `switch` with a `never` default — this is how adding an operation surfaces every rule that must handle it.
- No `any`. No non-null `!` in `lib/engine` or `lib/detect`.
- Database terminology in identifiers and UI, in English: `xmin`, `xmax`, `snapshot`, `gapLock`, `nextKeyLock`, `writeSkew`, `predicateRead`. A reader should be able to hold the Postgres docs beside the code.
- Anomaly ids stable and readable: `dirty-read`, `write-skew`, `lost-update`, `phantom-read`. They appear in scenario data and shared URLs.
- Pack ids carry the engine and version: `postgres-16`, `mysql-8-innodb`, `sqlserver-2022`.
- Comments cite the vendor documentation for any behaviour they implement.
- Tailwind utilities inline; semantic tokens in `tailwind.config.ts` — `manuscript`, `staff`, `ink`, `voiceA`, `voiceB`, `conductor`. Never raw hex in components.

## Testing rules

- `pnpm test:run` before every commit; `pnpm test:oracle` and `pnpm test:anomalies` before any commit touching `lib/engine`, `lib/detect`, or `data/packs`.
- New pack rule → an oracle fixture from the real engine, plus a citation in the pack.
- New anomaly → both-direction assertions across every level and every pack.
- New scenario → documented anomaly, permitting levels, oracle fixture per pack.
- Conflict-graph changes → brute-force serializability cross-check on the small-schedule corpus.
- Trace well-formedness asserted on every test: consistent version chains, no visibility of post-snapshot versions, every lock released at commit or rollback.
- Bug fix → failing test first.

## Upgrading an engine pack

Bump the image tag and the pack's `version`/`verifiedOn`, re-read the docs for anything that changed, `pnpm oracle:record --pack=<id>`, then `pnpm test:run`. `tests/oracle/versions.test.ts` catches a pack whose evidence came from a different build or whose fixtures mix builds; the simulator comparison catches the behaviour change itself. A disagreement between the model and a fresh recording is the recording's win — fix the pack and cite what changed.

## Deployment

`main` builds and deploys via Actions; pack validation gates it. `basePath` must match the repository name; `.nojekyll` must exist in `out/`. Verify with `pnpm preview` before pushing.

## Framing

The site states plainly that this models documented behaviour for a fixed operation set at specific engine versions, that it is not a database, and that unmodelled cases are refused rather than approximated. Every engine claim links to the vendor documentation behind it.

## Current state

**Live at https://andifathulms.github.io/isolation-anomaly/** — `main` deploys through Actions, gated on pack validation, typecheck, lint and the full suite.

M0–M6 built. Five engine packs shipping: PostgreSQL 16, MySQL 8.4 InnoDB, SQL Server 2022, SQL Server 2022 with RCSI, Oracle 23ai. (PRD §3 caps v1 at three; Oracle is the M6 pack the milestone table calls for, and it is the one that makes the naming lesson undeniable.)

- Oracle harness records against PostgreSQL 16.14, MySQL 8.4.11, SQL Server 16.0.4265.3 and Oracle 23.26.2.0.0 in containers. 150 fixtures under `tests/oracle/`. Waits are read from `pg_stat_activity`, `performance_schema.data_lock_waits` `sys.dm_exec_requests` and `v$session.blocking_session` rather than inferred from a slow statement. Re-recording produces byte-identical fixtures.
- SQL Server runs under x86 emulation on Apple Silicon (there is no arm64 image). Same binary, same semantics; the recorded version string identifies the server that answered.
- Executor matches every fixture: values read, error codes and their steps, where execution waited and until when, transaction outcomes, rows affected, final table.
- Detector, scenario library (10 scenarios), conflict graph with brute-force cross-check, and the full UI in English and Indonesian.
- 622 tests. `pnpm test:run` covers the oracle comparison, both-direction detection and the serializability cross-check.

Open modelling boundaries, all declared as pack rules with citations rather than assumed in the executor:

- **Deadlock victim selection** is `deadlockVictim`. PostgreSQL and InnoDB roll back the transaction whose wait closed the cycle, and the recordings agree. SQL Server picks by cost estimate — the same schedule loses T1 at REPEATABLE READ and T2 at SERIALIZABLE — so its pack declares the victim `unmodelled` and the executor refuses the whole run. Five recorded runs are refused; `tests/oracle` checks each refusal is justified by a deadlock in the fixture.
- **What a session does after the engine rolls its transaction back** is `afterAbort`: PostgreSQL rejects statements with 25P02, SQL Server autocommits each one, which is how a swallowed 3960 still writes to the table.
- **READ_COMMITTED_SNAPSHOT** is a second pack (`sqlserver-2022-rcsi`), not a flag, and the two are recorded against separate databases on the same server so the option cannot leak between them.
- **`failureScope`** is how much a serialization failure destroys: the transaction everywhere except Oracle, where it is the statement — and then every later write or locking read in that transaction raises the same error, which the recording shows and the model reproduces.
- **A plain read after Oracle's ORA-08177 is not exercised** by the library, so the model lets it proceed from the snapshot. If a scenario ever needs it, record it first.
- **Lock wait timeouts are not modelled.** `innodb_lock_wait_timeout` is left long enough that it never fires inside a recorded run; a statement still waiting when a schedule ends is recorded as exactly that.
- **Duplicate-key inserts are refused**, not modelled.
