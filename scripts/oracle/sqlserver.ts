import mssql from 'mssql'
import type { InitialRow, IsolationLevel, Operation } from '../../lib/schedule'
import { toSql } from '../../lib/schedule'
import type { OracleDriver, OracleSession, ReadShape, StatementResult } from './driver'

const SERVER = {
  server: '127.0.0.1',
  port: 55433,
  user: 'sa',
  password: 'Oracle_harness1',
  options: { encrypt: false, trustServerCertificate: true },
  pool: { min: 1, max: 1 },
  // No client-side statement timeout. The harness deliberately leaves
  // statements blocked across steps, and tedious defaults to failing them after
  // 15 seconds — a client artifact that would be recorded as engine behaviour.
  // pg and mysql2 impose no such limit, so this makes the three comparable.
  requestTimeout: 0,
  connectionTimeout: 60000,
} as const

const DATABASE = 'oracle'

/**
 * SQL Server 2022 in a container.
 *
 * Two things here are engine-specific rather than incidental. T-SQL has no
 * `FOR UPDATE`, so a locking read is `WITH (UPDLOCK)` — which is why the driver
 * interface lets an engine supply its own statement for an operation instead of
 * assuming one dialect. And SNAPSHOT is not available at all until
 * ALLOW_SNAPSHOT_ISOLATION is switched on for the database, so the harness sets
 * it: a level that has to be enabled is still a level the engine has, and
 * recording it is the only way to show that its SNAPSHOT permits write skew.
 *
 * READ_COMMITTED_SNAPSHOT is deliberately left OFF, which is the SQL Server
 * default and the configuration the pack models.
 */
export function createSqlServerDriver(): OracleDriver {
  let admin: mssql.ConnectionPool | null = null

  async function adminPool(): Promise<mssql.ConnectionPool> {
    if (admin) return admin

    const bootstrap = await new mssql.ConnectionPool({ ...SERVER, database: 'master' }).connect()
    await bootstrap.request().batch(
      `IF DB_ID('${DATABASE}') IS NULL CREATE DATABASE ${DATABASE};`,
    )
    // Snapshot isolation is off by default and cannot be requested without it.
    await bootstrap.request().batch(`ALTER DATABASE ${DATABASE} SET ALLOW_SNAPSHOT_ISOLATION ON;`)
    await bootstrap.request().batch(`ALTER DATABASE ${DATABASE} SET READ_COMMITTED_SNAPSHOT OFF;`)
    await bootstrap.close()

    admin = await new mssql.ConnectionPool({ ...SERVER, database: DATABASE }).connect()
    return admin
  }

  return {
    packId: 'sqlserver-2022',
    engine: 'Microsoft SQL Server',
    image: 'mcr.microsoft.com/mssql/server:2022-latest',
    service: 'sqlserver',

    async serverVersion() {
      const pool = await adminPool()
      const result = await pool
        .request()
        .query<{ version: string }>(
          "SELECT CAST(SERVERPROPERTY('ProductVersion') AS nvarchar(64)) AS version",
        )
      return String(result.recordset[0]?.version ?? 'unknown')
    },

    async reset(rows) {
      const pool = await adminPool()
      await pool.request().batch("IF OBJECT_ID('dbo.items', 'U') IS NOT NULL DROP TABLE dbo.items;")
      await pool.request().batch('CREATE TABLE dbo.items (k int PRIMARY KEY, v int NOT NULL);')
      for (const row of rows) {
        await pool.request().query(`INSERT INTO items (k, v) VALUES (${row.key}, ${row.value})`)
      }
    },

    async openSession(txn, level): Promise<OracleSession> {
      const pool = await new mssql.ConnectionPool({ ...SERVER, database: DATABASE }).connect()
      // The level is set on the session before any transaction starts: SQL
      // Server aborts a transaction that tries to change *into* SNAPSHOT.
      await pool.request().batch(`SET TRANSACTION ISOLATION LEVEL ${level};`)
      const spid = await pool.request().query<{ spid: number }>('SELECT @@SPID AS spid')

      return {
        txn,
        id: Number(spid.recordset[0]?.spid ?? 0),
        send(statement: string, expect: ReadShape): Promise<StatementResult> {
          return pool
            .request()
            .batch(statement)
            .then((result): StatementResult => {
              const affected = result.rowsAffected.reduce((total, count) => total + count, 0)
              if (expect === 'rows') {
                const rows = (result.recordset ?? []) as ReadonlyArray<{ k: number; v: number }>
                return {
                  read: {
                    type: 'rows',
                    rows: rows.map((row) => ({ key: Number(row.k), value: Number(row.v) })),
                  },
                  rowsAffected: null,
                  tag: null,
                }
              }
              if (expect === 'row') {
                const first = ((result.recordset ?? []) as ReadonlyArray<{ v: number }>)[0]
                return {
                  read: { type: 'row', value: first === undefined ? null : Number(first.v) },
                  rowsAffected: null,
                  tag: null,
                }
              }
              return { read: null, rowsAffected: affected, tag: null }
            })
        },
        async close() {
          await pool.close()
        },
      }
    },

    beginStatement() {
      // The level was set on the session when it was opened.
      return 'BEGIN TRANSACTION'
    },

    commitStatement() {
      return 'COMMIT TRANSACTION'
    },

    rollbackStatement() {
      return 'ROLLBACK TRANSACTION'
    },

    statementFor(op: Operation) {
      // T-SQL has no FOR UPDATE; the equivalent is an UPDLOCK table hint.
      if (op.type === 'selectForUpdate') {
        return `SELECT v FROM items WITH (UPDLOCK) WHERE k = ${op.key}`
      }
      return toSql(op)
    },

    async finalState() {
      const pool = await adminPool()
      const result = await pool
        .request()
        .query<{ k: number; v: number }>('SELECT k, v FROM items ORDER BY k')
      return result.recordset.map((row): InitialRow => ({ key: Number(row.k), value: Number(row.v) }))
    },

    async isWaitingOnLock(sessionId: number) {
      const pool = await adminPool()
      const result = await pool
        .request()
        .query<{ waiting: number }>(
          `SELECT COUNT(*) AS waiting FROM sys.dm_exec_requests
            WHERE session_id = ${sessionId} AND blocking_session_id <> 0`,
        )
      return Number(result.recordset[0]?.waiting ?? 0) > 0
    },

    errorAbortsTransaction(code: string) {
      // A deadlock victim is rolled back, and a snapshot update conflict aborts
      // the transaction by definition — "Snapshot isolation transaction aborted".
      return code === '1205' || code === '3960'
    },

    errorCode(error: unknown) {
      if (typeof error === 'object' && error !== null && 'number' in error) {
        return String((error as { number: unknown }).number)
      }
      return 'unknown'
    },

    errorMessage(error: unknown) {
      if (error instanceof Error) return error.message
      return String(error)
    },

    async close() {
      if (admin) {
        await admin.close()
        admin = null
      }
    },
  }
}
