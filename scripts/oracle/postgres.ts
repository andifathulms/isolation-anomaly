import { Client } from 'pg'
import type { InitialRow, IsolationLevel, Operation } from '../../lib/schedule'
import { toSql } from '../../lib/schedule'
import type { OracleDriver, OracleSession, ReadShape, StatementResult } from './driver'

const CONNECTION = {
  host: '127.0.0.1',
  port: 55432,
  user: 'postgres',
  password: 'oracle',
  database: 'oracle',
} as const

/**
 * PostgreSQL 16 in a container. Level names are passed through verbatim,
 * including READ UNCOMMITTED — the point of recording it is to see the engine
 * accept the name and behave as READ COMMITTED.
 */
export function createPostgresDriver(): OracleDriver {
  let admin: Client | null = null

  async function adminClient(): Promise<Client> {
    if (!admin) {
      admin = new Client(CONNECTION)
      await admin.connect()
    }
    return admin
  }

  return {
    packId: 'postgres-16',
    engine: 'PostgreSQL',
    image: 'postgres:16-alpine',
    service: 'postgres',

    async serverVersion() {
      const client = await adminClient()
      const result = await client.query<{ server_version: string }>('SHOW server_version')
      return result.rows[0]?.server_version ?? 'unknown'
    },

    async reset(rows) {
      const client = await adminClient()
      await client.query('DROP TABLE IF EXISTS items')
      await client.query('CREATE TABLE items (k int PRIMARY KEY, v int NOT NULL)')
      for (const row of rows) {
        await client.query('INSERT INTO items (k, v) VALUES ($1, $2)', [row.key, row.value])
      }
    },

    async openSession(txn): Promise<OracleSession> {
      // The level travels on BEGIN, so the session itself needs no preparation.
      const client = new Client(CONNECTION)
      await client.connect()
      const pid = await client.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')
      return {
        txn,
        id: Number(pid.rows[0]?.pid ?? 0),
        send(statement: string, expect: ReadShape): Promise<StatementResult> {
          return client.query(statement).then((result): StatementResult => {
            const tag = result.command ?? null
            if (expect === 'rows') {
              const rows = result.rows as ReadonlyArray<{ k: number; v: number }>
              return {
                read: {
                  type: 'rows',
                  rows: rows.map((row) => ({ key: Number(row.k), value: Number(row.v) })),
                },
                rowsAffected: null,
                tag,
              }
            }
            if (expect === 'row') {
              const first = (result.rows as ReadonlyArray<{ v: number }>)[0]
              return {
                read: { type: 'row', value: first === undefined ? null : Number(first.v) },
                rowsAffected: null,
                tag,
              }
            }
            return { read: null, rowsAffected: result.rowCount, tag }
          })
        },
        async close() {
          await client.end()
        },
      }
    },

    beginStatement(level: IsolationLevel) {
      return `BEGIN TRANSACTION ISOLATION LEVEL ${level}`
    },

    commitStatement() {
      return 'COMMIT'
    },

    rollbackStatement() {
      return 'ROLLBACK'
    },

    statementFor(op: Operation) {
      return toSql(op)
    },

    async finalState() {
      const client = await adminClient()
      const result = await client.query<{ k: number; v: number }>(
        'SELECT k, v FROM items ORDER BY k',
      )
      return result.rows.map((row): InitialRow => ({ key: Number(row.k), value: Number(row.v) }))
    },

    async isWaitingOnLock(sessionId: number) {
      const client = await adminClient()
      const result = await client.query<{ waiting: string }>(
        `SELECT count(*) AS waiting FROM pg_stat_activity
          WHERE pid = $1 AND wait_event_type = 'Lock'`,
        [sessionId],
      )
      return Number(result.rows[0]?.waiting ?? 0) > 0
    },

    errorAbortsTransaction() {
      // "current transaction is aborted, commands ignored until end of
      // transaction block" — any error puts the block in a failed state, and
      // COMMIT then answers with the tag ROLLBACK.
      return true
    },

    errorCode(error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error) {
        return String((error as { code: unknown }).code)
      }
      return 'unknown'
    },

    errorMessage(error: unknown) {
      if (error instanceof Error) return error.message
      return String(error)
    },

    async close() {
      if (admin) {
        await admin.end()
        admin = null
      }
    },
  }
}
