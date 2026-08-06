import { z } from 'zod'
import { LEVELS } from '@/lib/schedule/levels'

/**
 * Pack integrity at build time — PRD §7. `pnpm packs:validate` gates the build,
 * so a pack rule without a vendor citation cannot ship.
 */

const citationSchema = z.object({
  source: z.string().min(3),
  url: z.string().url().startsWith('https://', 'Citations must be https URLs.'),
  quote: z
    .string()
    .min(20, 'A citation quote must be long enough to locate on the page.'),
})

function rule<T extends z.ZodTypeAny>(value: T) {
  return z.object({ value, citation: citationSchema })
}

const levelName = z.enum(LEVELS)

const visibilitySchema = z.object({
  snapshot: z.enum(['statement', 'transaction']),
  readsUncommitted: z.boolean(),
  lockingReadsSeeLatestCommitted: z.boolean(),
  plainReadsAreLocking: z.boolean(),
})

const conflictsSchema = z.object({
  writeOnStaleRow: z.enum(['applyToLatest', 'abort']),
  lockingReadOnStaleRow: z.enum(['readLatest', 'abort']),
  writeWriteBlocks: z.boolean(),
})

const lockPlanSchema = z
  .object({
    record: z.enum(['none', 'shared', 'exclusive']),
    gap: z.enum(['none', 'gap', 'insertIntention']),
    duration: z.enum(['statement', 'transaction']),
  })
  .refine(
    (plan) => plan.record !== 'none' || plan.gap !== 'none' || plan.duration === 'statement',
    { message: 'A plan that takes no lock cannot declare transaction duration.' },
  )

const semanticsSchema = z.object({
  visibility: rule(visibilitySchema),
  conflicts: rule(conflictsSchema),
  locks: z.object({
    plainRead: rule(lockPlanSchema),
    lockingRead: rule(lockPlanSchema),
    write: rule(lockPlanSchema),
    insert: rule(lockPlanSchema),
  }),
  serializationCheck: rule(z.enum(['none', 'ssi'])),
})

const levelEntrySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('modelled'),
    displayName: z.string().min(1),
    summary: z.string().min(10),
    semantics: semanticsSchema,
  }),
  z.object({
    kind: z.literal('alias'),
    displayName: z.string().min(1),
    of: levelName,
    summary: z.string().min(10),
    citation: citationSchema,
  }),
  z.object({
    kind: z.literal('unsupported'),
    displayName: z.string().min(1),
    summary: z.string().min(10),
    citation: citationSchema,
  }),
])

const engineErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  citation: citationSchema,
})

export const enginePackSchema = z
  .object({
    id: z
      .string()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)+$/, 'Pack ids carry engine and version: postgres-16.'),
    engine: z.string().min(2),
    version: z.string().min(1),
    verifiedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'verifiedOn must be an ISO date.'),
    docsUrl: z.string().url(),
    defaultLevel: levelName,
    summary: z.string().min(20),
    errors: z.object({
      serializationFailure: engineErrorSchema,
      readWriteDependencies: engineErrorSchema.optional(),
      deadlock: engineErrorSchema.optional(),
      abortedTransaction: engineErrorSchema.optional(),
      commitAfterAbort: engineErrorSchema.optional(),
    }),
    deadlockVictim: rule(z.enum(['firstWaiter', 'lastWaiter', 'unmodelled'])).optional(),
    afterAbort: rule(z.enum(['rejectStatements', 'autocommitStatements'])).optional(),
    deadlockDetection: rule(z.enum(['immediate', 'afterLockTimeout'])).optional(),
    failureScope: rule(z.enum(['transaction', 'statementThenPoisoned'])).optional(),
    levels: z.object(
      Object.fromEntries(LEVELS.map((level) => [level, levelEntrySchema])) as Record<
        (typeof LEVELS)[number],
        typeof levelEntrySchema
      >,
    ),
  })
  .superRefine((pack, ctx) => {
    // Every level name the standard defines must be accounted for: implemented,
    // declared an alias, or declared unsupported. The schema shape guarantees
    // presence; these checks guarantee the declaration is coherent.
    for (const level of LEVELS) {
      const entry = pack.levels[level]
      if (entry.kind !== 'alias') continue
      if (entry.of === level) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['levels', level, 'of'],
          message: `${level} cannot be an alias for itself.`,
        })
        continue
      }
      const target = pack.levels[entry.of]
      if (target.kind !== 'modelled') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['levels', level, 'of'],
          message: `${level} aliases ${entry.of}, which is not a modelled level in this pack.`,
        })
      }
    }

    // An engine that runs a serialization check must document the error it
    // raises when the check fires — the error class is what an application
    // actually has to catch and retry.
    const runsSsi = LEVELS.some((level) => {
      const entry = pack.levels[level]
      return entry.kind === 'modelled' && entry.semantics.serializationCheck.value === 'ssi'
    })
    if (runsSsi && !pack.errors.readWriteDependencies) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['errors', 'readWriteDependencies'],
        message: 'A pack with an ssi serialization check must declare its read/write dependency error.',
      })
    }

    // A pack that models deadlocks must say which transaction loses one. The
    // choice changes the outcome, so leaving it implicit would hide a guess.
    if (pack.errors.deadlock && !pack.deadlockVictim) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['deadlockVictim'],
        message: 'A pack that declares a deadlock error must declare which transaction is the victim.',
      })
    }

    const defaultEntry = pack.levels[pack.defaultLevel]
    if (defaultEntry.kind !== 'modelled') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['defaultLevel'],
        message: `The default level ${pack.defaultLevel} must be modelled.`,
      })
    }
  })

export type ParsedEnginePack = z.infer<typeof enginePackSchema>
