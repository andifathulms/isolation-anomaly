# PORTFOLIO_CONTEXT — Isolation Anomaly

Raw material for a client-facing case study. Everything below is checked against the codebase, `git log`, `package.json` and the test run, not against the PRD's intentions. Where `CLAUDE.md` disagrees with the repo (it still says 622 tests, 150 fixtures, 10 scenarios), the repo wins and the current numbers are used.

---

## 1. One-line summary

An interactive teaching tool that lets a developer hand-build two overlapping database transactions, watch exactly where and why they corrupt each other's data, and then re-run the identical scenario against PostgreSQL, MySQL, SQL Server and Oracle to see the same code produce four different outcomes.

---

## 2. The problem

Every application developer configures a database *isolation level* — the setting that decides how much two simultaneous operations are allowed to interfere. Almost everyone accepts the default, and almost nobody can say what the default protects them from. Three concrete gaps:

- **The failure modes are taught as a list of names** — dirty read, non-repeatable read, phantom — recited in interviews and understood by few.
- **The most dangerous failure is missing from that list.** *Write skew*: two transactions each read the same data, each check a rule ("someone else is still on call, so I can go off call"), each write a *different* row, and both commit. Nothing collides — no shared row, no lock contention — and the rule is broken by the combination. This is what silently empties on-call rosters, double-books rooms and corrupts inventory counts. Snapshot isolation does not prevent it, and snapshot isolation is what most defaults amount to.
- **The level names mean different things in different engines, and no one says so.** PostgreSQL's `REPEATABLE READ` is snapshot isolation. PostgreSQL's `READ UNCOMMITTED` silently behaves as `READ COMMITTED`. Oracle's `SERIALIZABLE` is snapshot isolation, so it permits write skew *despite the name*. A developer who learns "REPEATABLE READ" from a textbook and applies it to Postgres has learned something that is not true of the database in front of them.

**Who it's for:** backend and full-stack developers making a real isolation-level decision; interview prep; university and bootcamp database courses; anyone debugging a concurrency bug that "shouldn't be possible".

---

## 3. My role

Sole author. All 38 commits, all 9,255 lines of application code and 1,701 lines of test code, are mine — `git shortlog` shows one contributor. There is no inherited codebase and no starter template beyond `next dev` scaffolding.

Built from scratch:

- the transaction schedule model and its fixed operation vocabulary
- the MVCC core (version chains, snapshot visibility) and the lock manager (including range and gap locks)
- the single engine executor that interprets JSON rule packs
- the five engine packs, each rule researched in vendor documentation and carrying its citation
- the containerised oracle harness that runs every schedule against real PostgreSQL, MySQL, SQL Server and Oracle and commits what they did as fixtures
- the independent anomaly detector
- the conflict graph, cycle detection and brute-force serializability cross-check
- the entire UI, in English and Indonesian, plus the brand mark
- the CI pipeline and static deploy

Used as-is: Next.js, React, Tailwind, Zod, Vitest, the official database drivers, and the vendors' own Docker images. No database library, no SQL parser, no graph-layout library — those are written here because the PRD forbids the dependency.

---

## 4. Technical approach

**Real databases are the oracle, and they came first.** The instinct with a project like this is to write the simulator from what you know about how databases work. That instinct is exactly the failure mode — a developer will make a production decision from what this shows. So before the executor existed, there was a harness that starts real PostgreSQL, MySQL, SQL Server and Oracle in containers, executes every schedule against them, and records what actually happened: every value read, every error code, where execution blocked and until when, whether each transaction committed. Those recordings are committed to the repo as 220 fixtures. The simulator is then built to match them, and when the two disagree, the simulator is wrong. This is unusually strong verification for an educational toy, and it is what makes the site's claims quotable.

Waits in particular are read from the engine's own instrumentation — `pg_stat_activity`, `performance_schema.data_lock_waits`, `sys.dm_exec_requests`, `v$session.blocking_session` — rather than inferred from a statement that happened to be slow. Re-recording produces byte-identical fixtures.

**Engine differences are data, not code.** There is one executor, one MVCC core, one lock manager. An engine is a JSON file of rules: what each level name actually maps to, when a lock is taken, what conflicts with what, what aborts and with which error code. There is no `if (engine === 'postgres')` anywhere. Two reasons: the cross-engine comparison is only meaningful if the machinery is shared — otherwise you are comparing implementations rather than semantics — and a pack is reviewable by a Postgres expert who has never read the codebase.

**Every rule cites the vendor documentation, and the build enforces it.** A pack rule without a citation and an engine version fails validation, and validation gates the deploy. If it can't be cited, it isn't known, and it doesn't ship.

**The detector shares no code with the executor.** Anomaly detection reads the finished execution trace and evaluates each anomaly from its published definition. A detector built on the executor's assumptions would happily validate the executor's bugs. Every scenario is asserted in both directions: the anomaly must appear at levels that permit it and must *not* appear at levels that prevent it — a one-directional test passes a detector that fires constantly.

**Refuse rather than approximate.** Anything outside the modelled set returns a structured refusal naming the gap. The clearest example: SQL Server picks its deadlock victim by cost estimate, so the same schedule loses T1 at one level and T2 at another. Rather than guess, its pack declares victim selection `unmodelled` and the executor refuses the whole run — and a test asserts each refusal is justified by a real deadlock in the recording.

**Execution is recorded, not re-run.** Stepping backward through a schedule is free, and the trace is byte-identical for identical inputs — no clock, no randomness, no module-level state in the engine.

**Static all the way down.** Next.js static export to GitHub Pages, no backend, no runtime fetches, schedules shared by URL hash. The database drivers and Docker are development-only and never reach the browser bundle.

---

## 5. Actual tech stack

Verified from `package.json`.

**Runtime dependencies — four:**
- Next.js 14.2.15 (App Router, `output: 'export'`)
- React 18.3.1 / React DOM
- Zod 3.23.8 — engine-pack schema validation

**Build / dev:**
- TypeScript 5.6.3, `strict: true`, no `any`
- Tailwind CSS 3.4.14 with semantic design tokens (`manuscript`, `staff`, `ink`, `voiceA`, `voiceB`, `conductor`)
- Vitest 2.1.3
- tsx, ESLint / eslint-config-next, PostCSS, Autoprefixer
- pnpm 9.15.9

**Oracle harness (development only, never in CI or the bundle):**
- Docker Compose — `docker-compose.oracle.yml`
- `pg` 8.13.0, `mysql2` 3.11.3, `mssql` ^12.7.0, `oracledb` ^7.0.1

**Deploy:** GitHub Actions → GitHub Pages, gated on pack validation, typecheck, lint and the full test suite.

Notably absent by design: no database library, no SQL parser, no graph-layout library, no state-management library, no charting library, no ML.

---

## 6. Notable features

- **The score.** Transactions as parallel staves on manuscript paper, operations as marks, bar lines at each execution step, so reading straight down a bar line tells you what was happening simultaneously. Marks can be dragged to re-interleave the schedule, which immediately re-runs it.
- **Stepping with visible internal state.** Step forward and back through execution with three live panels: MVCC version chains (which tuple versions exist, who created and deleted them, who can see them), locks held including range and gap locks, and which transactions were visible when each snapshot was taken.
- **The conductor's mark.** A single red annotation over the exact step at which the anomaly became inevitable — pointing at the cause, not the symptom — with the anomaly named, its definition cited, and a one-sentence mechanism generated from the trace rather than written prose. Red is used for nothing else anywhere in the app.
- **The cross-engine matrix.** The same schedule against all five packs at every level: committed, aborted with which error code, completed-with-anomaly, or refused. This is where a developer sees at a glance that their default configuration permits the thing they assumed was impossible.
- **The conflict graph.** Transactions as nodes, conflicting operation pairs as edges. A cycle means the schedule is not conflict-serializable, and the cycle *is* the explanation. Cross-checked against brute-force enumeration of every serial ordering on a small-schedule corpus, including three-transaction schedules.
- **Scenario library and custom editor.** Eleven scenarios with framings that make the stakes obvious — an on-call roster for write skew, a bank transfer for read skew, inventory decrement for lost update, a booking system for phantoms — plus a build-your-own editor whose runs share by URL hash.
- **Engine packs page.** Every modelled rule printed beside the vendor documentation link that justifies it, with the engine version and verification date.
- **Bilingual.** Indonesian and English throughout, with database terminology deliberately left in English because that is how the reader will meet it in documentation and error messages.

---

## 7. Challenges and tradeoffs

**Scope grew past the PRD, deliberately.** The PRD caps v1 at three engine packs (§3) because each one is genuine documentation research. Five shipped: PostgreSQL 16, MySQL 8.4 InnoDB, SQL Server 2022, SQL Server 2022 with RCSI, and Oracle 23ai. Oracle was the M6 stretch pack and it earned its place — an engine whose level literally named `SERIALIZABLE` permits write skew is the argument the whole project is making, made undeniable. Commit `ce42f50`: *"Oracle 23ai — the level called SERIALIZABLE permits write skew"*.

**RCSI became a second engine, not a flag.** SQL Server's `READ_COMMITTED_SNAPSHOT` option changes the engine's semantics enough that modelling it as a toggle would have smuggled a conditional into the executor. It ships as a separate pack, and the two are recorded against separate databases on the same server so the option cannot leak between recordings.

**Where the model refuses to answer.** Four boundaries are declared as cited pack rules rather than quietly approximated:
- *Deadlock victim selection.* PostgreSQL and InnoDB roll back the transaction that closed the cycle, and the recordings agree. SQL Server picks by cost estimate and is not predictable from the schedule, so its pack declares it `unmodelled` and five recorded runs are refused outright.
- *What a session does after its transaction is rolled back.* PostgreSQL rejects further statements with `25P02`; SQL Server autocommits each one — which is how a swallowed `3960` still writes to the table.
- *How much a serialization failure destroys.* The transaction, everywhere except Oracle, where it is only the statement — and then every later write in that transaction raises the same error.
- *Lock wait timeouts are not modelled at all.* A statement still waiting when a schedule ends is recorded as exactly that.

**A recording caught a rule I had wrong.** Commit `9aca614`: *"a deadlock schedule, and the rule it caught me getting wrong"* — the harness doing its job, which is the entire reason it was built before the executor.

**SQL Server on Apple Silicon.** There is no arm64 image, so it runs under x86 emulation. Same binary, same semantics, and the recorded version string identifies the server that actually answered.

**Late repositioning toward the non-expert.** A cluster of commits near the end moves the argument in front of the vocabulary rather than behind it: `dba0d63` *"the failure before the vocabulary"*, `c998ed7` *"say what this is before naming what it is called"*, `2e72ee7` *"the verdict above the machinery"*, `6524f95` *"a notation key, and a first run that explains itself"*. The engine was correct well before the site was legible; making it legible was its own pass.

**The name changed.** The PRD calls it *Sekat* (Indonesian: a partition, a divider — "isolation is a matter of how much *sekat* you buy"). The shipped slug and repo are `isolation-anomaly`, which is searchable in English.

---

## 8. Status

**Live and public.** https://andifathulms.github.io/isolation-anomaly/ — repo `andifathulms/isolation-anomaly` is public on GitHub, created 6 August 2026.

`main` builds and deploys through GitHub Actions, gated on pack validation, typecheck, lint and the full test suite. Production, not prototype, in the sense that everything it claims is verified against a real engine and the boundaries of what it will claim are explicit. Working tree clean; the full suite passes.

---

## 9. Metrics

| | |
|---|---|
| Commits | 38, all by one author |
| Time span | 6–7 August 2026 (two days) |
| Application code | 9,255 lines TypeScript / TSX across `app/`, `components/`, `lib/`, `scripts/` |
| Test code | 1,701 lines |
| Tests | **1,551 passing**, 11 files, ~3.6s |
| Recorded oracle fixtures | **220** JSON files across 5 engine directories |
| Engine packs | **5** — postgres-16, mysql-8-innodb, sqlserver-2022, sqlserver-2022-rcsi, oracle-23ai |
| Vendor citations in packs | 328 across the five packs |
| Scenarios | **11** |
| Pages | **6** per locale × 2 locales — overview, schedule, scenarios, matrix, graph, engines |
| Engine versions recorded | PostgreSQL 16.14, MySQL 8.4.11, SQL Server 16.0.4265.3, Oracle 23.26.2.0.0 |
| Runtime dependencies | 4 |

Test breakdown worth quoting: 1,215 of the tests are simulator-vs-real-database comparisons, and 229 are both-direction anomaly assertions across every scenario, level and pack.

---

## 10. Suggested screenshots

Two already exist in the repo (`docs/screenshots/schedule-light.png`, `schedule-dark.png`, `matrix.png`) and are used in the README.

1. **The score with the conductor's mark firing on write skew** — the signature image and the one to lead with. Two staves, both transactions reading the roster, both writing a different row, both committing, and the red mark on the step where it became unavoidable.
   `components/score/Score.tsx`, `components/score/Workbench.tsx`, `components/score/AnomalyCallout.tsx` · page [app/[locale]/schedule/page.tsx](app/[locale]/schedule/page.tsx) · live at `/en/schedule/#s=write-skew&p=postgres-16&l=RR&i=5`
   *Caption angle: the same schedule at `SERIALIZABLE` gets aborted instead — one dropdown apart.*

2. **The cross-engine matrix** — the differentiator, and the fastest way to show a non-expert that "the level names are lies". One schedule, five engines, every level, with commits, aborts-with-error-code, anomalies and refusals in one grid.
   `components/matrix/Matrix.tsx` · page [app/[locale]/matrix/page.tsx](app/[locale]/matrix/page.tsx)
   *Caption angle: Oracle's column, where `SERIALIZABLE` commits with no error at all.*

3. **Stepping with the state panels open** — version chains and the lock table mid-schedule. This is the "it actually models the machinery" shot, and the one that separates this from a static explainer.
   `components/versions/VersionChains.tsx`, `components/locks/LockTable.tsx`, `components/score/SnapshotPanel.tsx`, `components/score/StepList.tsx`

4. **The engine packs page** — a rule printed beside the vendor documentation link that justifies it, with the engine version and verification date. Proves the sourcing claim rather than asserting it.
   page [app/[locale]/engines/page.tsx](app/[locale]/engines/page.tsx)

5. *(optional fifth)* **The conflict graph with a highlighted cycle** — for a technical audience, the formal answer beside the practical one.
   `components/graph/ConflictGraphView.tsx` · page [app/[locale]/graph/page.tsx](app/[locale]/graph/page.tsx)

Both light and dark are worth capturing — the palette is a designed pair, and the design system (manuscript paper, staff grey, two transaction voices, one reserved red) is itself part of the story.
