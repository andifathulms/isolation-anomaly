import { describe as suite, expect, it } from 'vitest'
import {
  isReadOperation,
  isWriteOperation,
  notate,
  operationKey,
  predicateContains,
  toSql,
  validateSchedule,
  type Schedule,
} from '@/lib/schedule'

const wellFormed: Schedule = {
  id: 'test-well-formed',
  title: 'Well formed',
  transactions: ['T1', 'T2'],
  initial: [{ key: 1, value: 100 }],
  steps: [
    { txn: 'T1', op: { type: 'begin' } },
    { txn: 'T2', op: { type: 'begin' } },
    { txn: 'T1', op: { type: 'read', key: 1 } },
    { txn: 'T2', op: { type: 'write', key: 1, value: 200 } },
    { txn: 'T2', op: { type: 'commit' } },
    { txn: 'T1', op: { type: 'read', key: 1 } },
    { txn: 'T1', op: { type: 'commit' } },
  ],
}

suite('schedule validation', () => {
  it('accepts a well-formed schedule', () => {
    expect(validateSchedule(wellFormed)).toEqual([])
  })

  it('rejects an operation before begin', () => {
    const issues = validateSchedule({
      ...wellFormed,
      steps: [{ txn: 'T1', op: { type: 'read', key: 1 } }],
    })
    expect(issues.map((issue) => issue.message)).toContain('T1 acts before it begins.')
  })

  it('rejects work after a commit', () => {
    const issues = validateSchedule({
      ...wellFormed,
      transactions: ['T1'],
      steps: [
        { txn: 'T1', op: { type: 'begin' } },
        { txn: 'T1', op: { type: 'commit' } },
        { txn: 'T1', op: { type: 'read', key: 1 } },
      ],
    })
    expect(issues).toEqual([
      { step: 2, message: 'T1 has already committed or rolled back.' },
    ])
  })

  it('rejects an undeclared transaction', () => {
    const issues = validateSchedule({
      ...wellFormed,
      transactions: ['T1'],
      steps: [
        { txn: 'T1', op: { type: 'begin' } },
        { txn: 'T9', op: { type: 'begin' } },
        { txn: 'T1', op: { type: 'commit' } },
      ],
    })
    expect(issues).toEqual([{ step: 1, message: 'T9 is not declared in transactions.' }])
  })

  it('rejects a duplicated initial key', () => {
    const issues = validateSchedule({
      ...wellFormed,
      initial: [
        { key: 1, value: 1 },
        { key: 1, value: 2 },
      ],
    })
    expect(issues).toEqual([{ step: null, message: 'Initial state declares key 1 twice.' }])
  })
})

suite('operation classification', () => {
  it('classifies select for update as a read', () => {
    expect(isReadOperation({ type: 'selectForUpdate', key: 1 })).toBe(true)
    expect(isWriteOperation({ type: 'selectForUpdate', key: 1 })).toBe(false)
  })

  it('classifies delete as a write', () => {
    expect(isWriteOperation({ type: 'delete', key: 1 })).toBe(true)
  })

  it('reports no single key for a range read', () => {
    expect(operationKey({ type: 'readRange', predicate: { type: 'keyRange', from: 1, to: 5 } })).toBeNull()
  })
})

suite('predicates', () => {
  it('is inclusive at both ends', () => {
    const predicate = { type: 'keyRange', from: 2, to: 4 } as const
    expect([1, 2, 3, 4, 5].filter((key) => predicateContains(predicate, key))).toEqual([2, 3, 4])
  })
})

suite('notation', () => {
  it('reads as schedule algebra', () => {
    expect(notate({ type: 'read', key: 1 }, 0)).toBe('r1[1]')
    expect(notate({ type: 'write', key: 1, value: 5 }, 1)).toBe('w2[1=5]')
    expect(notate({ type: 'rollback' }, 1)).toBe('a2')
    expect(
      notate({ type: 'readRange', predicate: { type: 'keyRange', from: 1, to: 9 } }, 0),
    ).toBe('r1[P:1..9]')
  })
})

suite('sql projection', () => {
  it('emits ordered range reads so results compare across engines', () => {
    expect(toSql({ type: 'readRange', predicate: { type: 'keyRange', from: 1, to: 3 } })).toBe(
      'SELECT k, v FROM items WHERE k BETWEEN 1 AND 3 ORDER BY k',
    )
  })

  it('leaves transaction control to the harness dialect', () => {
    expect(toSql({ type: 'begin' })).toBeNull()
    expect(toSql({ type: 'commit' })).toBeNull()
  })
})
