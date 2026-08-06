import type { AnomalyId } from '@/lib/detect/catalog'
import type { IsolationLevel, Schedule } from '@/lib/schedule'

/**
 * A scenario is a schedule with its documented anomaly and, per engine pack,
 * the levels at which that anomaly is expected to occur.
 *
 * The expectation lists are what makes detection testable in both directions:
 * the anomaly must appear at every level named here and must *not* appear at
 * any other level the pack models. A one-directional test would pass a
 * detector that fires constantly.
 *
 * They are also a claim about a real database, so every one of them is checked
 * against a recorded fixture from the running engine.
 */
export type Scenario = {
  readonly id: string
  readonly title: string
  /** The real framing that makes the stakes obvious. */
  readonly framing: string
  /** What the reader should take away, in one or two sentences. */
  readonly lesson: string
  /**
   * The anomaly this schedule is built to produce, or null when the schedule
   * exists to show what an engine *does* instead — a deadlock is a response,
   * not a phenomenon in the catalogue.
   */
  readonly anomaly: AnomalyId | null
  readonly schedule: Schedule
  readonly expectedAt: Readonly<Record<string, readonly IsolationLevel[]>>
}
