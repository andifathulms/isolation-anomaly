# PRD — Sekat

**Interleave two transactions by hand, watch the anomaly happen, then switch database engine and isolation level and watch the same schedule behave completely differently.**

> *sekat* (Indonesian) — a partition, a divider. Isolation is a matter of how much *sekat* you buy.
> Rename freely; the slug is used throughout as `sekat`.

| | |
|---|---|
| **Status** | Draft — pre-implementation |
| **Owner** | Andi Fathul Mukminin Salahuddin |
| **Type** | Personal portfolio project, open source, educational |
| **Deployment** | GitHub Pages (static export, no server) |
| **Language** | Indonesian-first UI; English secondary. Database terms stay in English. |
| **Normative sources** | ANSI SQL-92 isolation definitions; Berenson et al. (1995), *A Critique of ANSI SQL Isolation Levels*; Fekete et al. on serializable snapshot isolation; and each engine's own documentation. |

---

## 1. Problem

Every application developer picks an isolation level, usually by accepting the default, and almost none can say what it protects them from. Three specific gaps:

**The anomalies are taught as a list of names.** Dirty read, non-repeatable read, phantom. Recited in interviews, understood by few, and the list is *incomplete* — it omits the anomaly most likely to hurt a real application.

**Write skew is missing from the standard list and missing from most people's mental model.** Two transactions read the same data, each verify a constraint, each write a *different* row, and both commit. Nothing conflicted — no shared row, no lock contention, no version clash — and the constraint is violated by the combination. Snapshot isolation does not prevent it. This is the anomaly that silently corrupts inventory counts, double-books resources, and empties on-call rosters.

**The level names mean different things in different engines, and nobody says so.** PostgreSQL's REPEATABLE READ is snapshot isolation — it prevents phantoms, which ANSI does not require, and permits write skew. Oracle's SERIALIZABLE is also snapshot isolation, so it permits write skew *despite the name*. PostgreSQL's READ UNCOMMITTED silently behaves as READ COMMITTED. MySQL InnoDB's REPEATABLE READ uses gap locking and behaves differently again, and its default level is not PostgreSQL's default.

The ANSI definitions were criticised as inadequate in 1995 and every vendor shipped something different anyway. A developer who learns "REPEATABLE READ" from a textbook and applies it to Postgres has learned something that is not true of the database in front of them.

## 2. Product thesis

**A schedule you build by hand, executed against a modelled engine, with the anomaly named when it happens.**

Two commitments beyond the obvious:

1. **Engine packs, cited.** PostgreSQL, MySQL InnoDB, and SQL Server each get a documented behaviour model with the vendor documentation cited per rule. The same schedule runs across all of them, in a matrix showing what each does — commits, aborts, or produces an anomaly. **The disagreement is the lesson**, and it is the same "cited variant packs" pattern that makes Rinci and Lumbung trustworthy.

2. **The formal answer alongside the practical one.** Build the conflict graph for the schedule and detect its cycles. A cycle means the schedule is not conflict-serializable, and the cycle *is* the explanation for the anomaly. This turns "the database allowed something bad" into "here is precisely why no serial ordering produces this outcome."

## 3. Non-goals

- **Not a database.** No SQL parser beyond a tiny fixed operation vocabulary, no query planner, no storage engine, no indexes, no durability.
- **Not a performance model.** No throughput, no latency, no lock-wait timing. Correctness semantics only.
- **No distributed transactions.** No two-phase commit, no distributed snapshot isolation, no Spanner-style TrueTime. A whole separate project.
- **No engine behaviours outside the modelled operation set.** If a schedule uses something unmodelled, refuse and say so — never approximate.
- **No more than three engine packs in v1.** Each one is real research against real documentation and a real oracle.
- **No accounts, no server.** Schedules share by URL hash.
- **No ML.**

## 4. Scope

**Operations:** `begin`, `read(key)`, `write(key, value)`, `read range(predicate)`, `insert(key, value)`, `delete(key)`, `select for update(key)`, `commit`, `rollback`.

Range reads and inserts are non-negotiable — without them there are no phantoms, and phantoms are where engines diverge most.

**Anomalies detected:** dirty write, dirty read, lost update, non-repeatable read, phantom read, read skew, **write skew**.

**Levels:** READ UNCOMMITTED, READ COMMITTED, REPEATABLE READ, SNAPSHOT, SERIALIZABLE — with each engine pack declaring which of these it genuinely implements and which are aliases for something else.

**Engine packs v1:** PostgreSQL (MVCC, SSI at SERIALIZABLE), MySQL InnoDB (next-key locking), SQL Server (lock-based by default, with RCSI and SNAPSHOT as options). Oracle is a strong M5 candidate precisely because its SERIALIZABLE is snapshot isolation.

## 5. Features

### 5.1 The score — signature view
Transactions as parallel staves running left to right in step order, operations as marks on the line. You build a schedule by placing operations, and you can drag to re-interleave and re-run. Bar lines mark execution steps.

The conductor's mark — a red annotation over the exact step where an anomaly becomes inevitable — is the payoff, and it points at the *cause* rather than the symptom.

### 5.2 Stepping with visible state
Step forward and back through the schedule. At every step, three panels:

- **Version chains** — each key's tuple versions with the transaction that created and deleted them, and which versions each running transaction can see. MVCC made concrete.
- **Locks held** — for engines that lock, including range and gap locks, which is where phantom prevention actually lives.
- **Snapshots** — which transactions were visible when each snapshot was taken.

Step-back is free because execution is recorded, not re-run.

### 5.3 Anomaly detection
When an anomaly occurs, name it, cite its definition, mark the operations involved, and explain the mechanism in one sentence generated from the trace rather than written prose.

### 5.4 The engine matrix
The same schedule across every engine and level: committed, aborted with which error, or completed-with-anomaly. A grid where a developer can see at a glance that their default configuration permits the thing they assumed was impossible.

### 5.5 The conflict graph
Nodes are transactions, edges are conflicting operation pairs in execution order. A cycle means not conflict-serializable, and the cycle is highlighted. Shown beside a plain-language statement of what no serial order could produce.

### 5.6 Scenario library
Each classic anomaly as a runnable schedule, plus real framings that make the stakes obvious: a bank transfer for read skew, an on-call roster for write skew, inventory decrement for lost update, a booking system for phantoms.

Every scenario documents its anomaly, the levels that permit it, and the engines that permit it.

### 5.7 Schedule editor and sharing
Build your own schedule, share it by URL hash, and get an answer for the exact interleaving that broke production last week.

## 6. Architecture

Static Next.js 14 App Router export. No backend, no runtime fetches.

```
schedule + engine pack + level
  → executor (pure)  → ExecutionTrace { steps, versions, locks, snapshots, anomalies }
  → conflict graph   → cycle detection
                     → score | state panels | matrix | graph
```

**`lib/engine` is pure.** `(schedule, enginePack, level) → ExecutionTrace`. No React, no DOM, no clock, no randomness, no module-level mutable state. Byte-identical trace for identical inputs.

**Engine behaviour is declarative data, not code branches.** Each pack is a JSON rule set: visibility rules, lock acquisition and conflict matrix, what each level name maps to, what triggers an abort, and the vendor citation for each rule. The executor is an interpreter over packs. **No `if (engine === 'postgres')` anywhere** — that is what makes a pack reviewable by someone who knows the engine but not the codebase.

**One MVCC core, one lock manager, both parameterised by the pack.** Engines differ in their rules, not in their machinery. Forking the executor per engine would make the matrix a comparison of implementations rather than of semantics.

**Anomaly detection is independent of the executor.** It reads the trace and evaluates each anomaly from its published definition, sharing no code with the execution path. A detector built on the executor's assumptions would validate its own bugs.

**Refuse rather than approximate.** An operation or level a pack does not model returns a structured refusal naming the gap. Never guess at a vendor behaviour.

## 7. Testing

**Real databases as oracle — the backbone.** A development script runs every library schedule against real PostgreSQL, MySQL, and SQL Server in containers, recording what each transaction read, whether it committed or aborted, and the error if any. Committed as fixtures. The simulator must match.

This is unusually strong verification for a project of this kind, and it is entirely achievable — the schedules are small and the setup is scriptable.

**Anomaly detection in both directions.** Every scenario must produce its documented anomaly at levels that permit it, and must *not* produce it at levels that prevent it. One-directional testing would pass a detector that fires constantly.

**Serializability cross-check.** For small schedules, brute-force every serial ordering and compare against the conflict-graph cycle detection. Cycle present must equal no equivalent serial order. The graph is an optimisation of a definition, and the definition is testable.

**Trace well-formedness.** Version chains are consistent, no transaction sees a version created after its snapshot, locks are released at commit or rollback, every acquired lock has a matching release.

**Pack integrity at build time.** Every rule in every pack carries a vendor citation. Level aliases are declared explicitly. The build fails otherwise.

**Determinism.** Same schedule, pack, and level produce a byte-identical trace.

## 8. Design direction

The material world is the **conductor's full score**: parallel staves on manuscript paper, bar lines marking time, and the conductor's red pencil marking the moment something goes wrong. A transaction schedule *is* parallel voices in shared time, so the metaphor is structural rather than decorative.

**Palette.** Manuscript `#F2EEE2`. Staff grey `#A8A398` for the lanes and bar lines, deliberately recessive — the lines are scaffolding, not content. Ink `#1D1B17` for text. Transactions get two distinguishable voices: score blue `#2C4C7C` and sepia `#8A6A2E`, extended by pattern rather than by adding more hues if a third transaction is needed. **Conductor's red `#B03A2E` reserved exclusively for anomalies and aborts** — nothing else on the page is ever red.

**Type.** **Faustina** for prose and headings, a text serif with the warmth of engraved music. **Fira Code** for operations, keys, values, and version identifiers — dense, aligned, and unambiguous about characters that matter. **Work Sans** for controls.

**Structure.** Staves run the full width with bar lines at each execution step, so vertical alignment across transactions is exact — reading straight down a bar line tells you what was happening simultaneously, which is the entire skill of reading a schedule. State panels sit below, not beside, so the score keeps the full width.

**Motion.** One orchestrated moment: stepping advances a playhead down the score while the version chains and lock table update in place. When an anomaly fires, the conductor's mark draws once at the causing step. Nothing else moves.

**Copy.** Indonesian first; database terms stay in English — *dirty read*, *write skew*, *snapshot*, *gap lock*, *serializable* — because the reader will meet them in that form in documentation and error messages. Engine behaviours are always attributed: "PostgreSQL maps this level to snapshot isolation; see [citation]".

## 9. Milestones

| | | |
|---|---|---|
| **M0** | Scaffold + oracle | Static export deploying, schedule model, pack schema and validator, and the containerised oracle harness. **The oracle comes first** — it is what makes every later claim checkable. |
| **M1** | Executor | MVCC core, lock manager, PostgreSQL pack, execution trace. Oracle fixtures green. Console only. |
| **M2** | Detection | Independent anomaly detector, scenario library, both-direction tests. |
| **M3** | UI | Score view, stepping, version chains, lock table, snapshots. **Ship publicly here.** |
| **M4** | Matrix | MySQL and SQL Server packs, cross-engine comparison view, citations page. The differentiator. |
| **M5** | Conflict graph | Precedence graph, cycle detection, brute-force cross-check. |
| **M6** | Editor + polish | Custom schedule building, sharing, Oracle pack, a11y. |

M3 is a complete tool for one engine. M4 is the insight nobody else offers.

## 10. Success criteria

- Simulator matches real database behaviour across every library schedule, for every engine pack — committed versus aborted, values read, and error class.
- Every scenario produces its anomaly at permitting levels and not at preventing ones.
- Conflict-graph cycle detection agrees with brute-force serializability on every small schedule.
- Every pack rule carries a vendor citation, enforced by the build.
- Unmodelled operations and levels refuse with a named gap rather than approximating.
- Same inputs produce a byte-identical trace on any machine.
- A developer can go from a scenario to seeing the same schedule succeed on one engine and fail on another in under three interactions.
- Fully offline after first load. JS ≤ 250 KB gzipped.

## 11. Deployment

`output: 'export'`, `basePath` matching the repository name, `images.unoptimized`, `trailingSlash: true`, `.nojekyll` in the output root. Pack validation gates the deploy. The oracle harness is a development script — it never runs in CI and never ships in the bundle. Verify under the production `basePath` with `pnpm preview` before pushing.

## 12. Risks

| Risk | Mitigation |
|---|---|
| **Teaching wrong database behaviour.** | Real databases as oracle, from M0. Cited packs. Structured refusal outside the modelled set. Never infer a vendor behaviour from general MVCC knowledge. |
| **MySQL InnoDB's REPEATABLE READ is genuinely subtle** — locking and non-locking reads behave differently within one transaction. | Model it explicitly, with the documentation cited, and oracle fixtures covering both read kinds. If a case cannot be modelled faithfully, refuse rather than approximate. |
| **A detector that shares assumptions with the executor validates its own bugs.** | Independent detector, both-direction tests, brute-force serializability cross-check. |
| **Engine packs drift as vendors change behaviour across versions.** | Each pack records the engine version it models and the date verified. Oracle fixtures are regenerated against pinned container images. |
| **Scope creep into building a database.** | §3 is binding. Fixed operation vocabulary, no planner, no storage. |
| **Three engine packs is already a lot of research.** | Ship M3 with PostgreSQL alone. Additional packs are additive releases, not launch blockers. |
