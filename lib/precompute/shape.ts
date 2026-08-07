import type { IsolationLevel } from '@/lib/schedule'
import type { ConflictEdge } from '@/lib/serial'

/**
 * The shape of the precomputed data, separated from the code that produces it.
 *
 * The producing module imports the executor, the detector and all five packs.
 * A client component that needs only a type or the key format must not import
 * that module: `import { graphKey } from '@/lib/precompute'` pulled the entire
 * engine back into the graph page's bundle and undid the whole exercise. Types
 * are erased at compile time and would have been safe; `graphKey` is a value,
 * and one value is enough to drag a module graph behind it.
 */

export type MatrixCell =
  | { readonly kind: 'refused' }
  | {
      readonly kind: 'ran'
      readonly anomalies: readonly string[]
      readonly aborted: readonly string[]
      readonly errorCodes: readonly string[]
      readonly alias: string | null
    }

export type MatrixRow = {
  readonly packId: string
  readonly engine: string
  readonly version: string
  readonly summary: string
  readonly cells: readonly MatrixCell[]
}

export type MatrixScenario = {
  readonly id: string
  readonly title: string
  readonly framing: string
  /** Already localised, so the client never needs the anomaly catalogue. */
  readonly anomalyName: string | null
  readonly rows: readonly MatrixRow[]
}

export type GraphRun =
  | { readonly kind: 'refused' }
  | {
      readonly kind: 'ran'
      readonly nodes: readonly string[]
      readonly edges: readonly ConflictEdge[]
      /** Indices into `edges`, so the cycle survives losing object identity. */
      readonly onCycle: readonly number[]
      readonly cycle: readonly string[] | null
      /** The sentence generated from the cycle, already built. */
      readonly explanation: string | null
      readonly orders: readonly (readonly string[])[]
    }

export type GraphData = {
  readonly scenarios: readonly { readonly id: string; readonly title: string }[]
  readonly packs: readonly { readonly id: string; readonly engine: string; readonly version: string }[]
  /** Keyed `scenarioId|packId|level`. */
  readonly runs: Readonly<Record<string, GraphRun>>
}

export const graphKey = (scenarioId: string, packId: string, level: IsolationLevel): string =>
  `${scenarioId}|${packId}|${level}`
