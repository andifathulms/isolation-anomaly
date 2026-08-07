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
/**
 * What the keys and values mean in the scenario's own terms.
 *
 * The write-skew schedule reads `{1,2}` and writes `w1[1=0]`, and the story
 * beside it is about two doctors going off call. Nothing connected the two:
 * "rows 1 and 2 are two doctors, v = 1 means on call" lived in a source comment
 * and never reached a reader. A framing the notation is never reconciled with
 * is not a framing, it is decoration.
 *
 * Keyed by the string form of the number so the record is plain JSON.
 */
export type ScenarioLegend = {
  /** What each key is: `{ '1': 'Dr A' }`. */
  readonly keys: Readonly<Record<string, string>>
  /** What each value means: `{ '1': 'on call', '0': 'off call' }`. */
  readonly values: Readonly<Record<string, string>>
}

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
  /** The key and value vocabulary, where the scenario has one worth naming. */
  readonly legend?: ScenarioLegend
  readonly schedule: Schedule
  readonly expectedAt: Readonly<Record<string, readonly IsolationLevel[]>>
}
