import oracledb from 'oracledb'
import type { InitialRow, IsolationLevel, Operation } from '../../lib/schedule'
import { toSql } from '../../lib/schedule'
import type { OracleDriver, OracleSession, ReadShape, StatementResult } from './driver'

const CONNECTION = {
  user: 'system',
  password: 'Oracle_harness1',
  connectString: '127.0.0.1:55521/FREEPDB1',
} as const

/**
 * Oracle Database 23ai Free in a container.
 *
 * Oracle has no BEGIN: a transaction starts with the first statement, and the
 * isolation level is set with SET TRANSACTION, which must itself be the first
 * statement of that transaction. So the level travels on what the harness calls
 * `begin`, which is exactly where it belongs here.
 *
 * node-oracledb does not autocommit by default, which is what the harness needs:
 * every session holds an open transaction until it is told otherwise.
 */
export function createOracleDriver(): OracleDriver {
  let admin: oracledb.Connection | null = null

  async function adminConnection(): Promise<oracledb.Connection> {
    if (!admin) admin = await oracledb.getConnection(CONNECTION)
    return admin
  }

  return {
    packId: 'oracle-23ai',
    engine: 'Oracle Database',
    image: 'gvenzl/oracle-free:23-slim',
    service: 'oracle',

    async serverVersion() {
      const connection = await adminConnection()
      const result = await connection.execute<[string]>(
        'SELECT version_full FROM product_component_version WHERE ROWNUM = 1',
      )
      return String(result.rows?.[0]?.[0] ?? 'unknown')
    },

    async reset(rows) {
      const connection = await adminConnection()
      // Oracle has no DROP TABLE IF EXISTS.
      await connection.execute(
        `BEGIN EXECUTE IMMEDIATE 'DROP TABLE items'; EXCEPTION WHEN OTHERS THEN NULL; END;`,
      )
      await connection.execute('CREATE TABLE items (k NUMBER PRIMARY KEY, v NUMBER NOT NULL)')
      for (const row of rows) {
        await connection.execute(`INSERT INTO items (k, v) VALUES (${row.key}, ${row.value})`)
      }
      await connection.commit()
    },

    async openSession(txn): Promise<OracleSession> {
      const connection = await oracledb.getConnection(CONNECTION)
      const sid = await connection.execute<[number]>('SELECT sid FROM v$mystat WHERE ROWNUM = 1')
      return {
        txn,
        id: Number(sid.rows?.[0]?.[0] ?? 0),
        send(statement: string, expect: ReadShape): Promise<StatementResult> {
          return connection
            .execute<readonly number[]>(statement)
            .then((result): StatementResult => {
            const rows = (result.rows ?? []) as ReadonlyArray<readonly number[]>
            if (expect === 'rows') {
              return {
                read: {
                  type: 'rows',
                  rows: rows.map((row) => ({ key: Number(row[0]), value: Number(row[1]) })),
                },
                rowsAffected: null,
                tag: null,
              }
            }
            if (expect === 'row') {
              const first = rows[0]
              return {
                read: { type: 'row', value: first === undefined ? null : Number(first[0]) },
                rowsAffected: null,
                tag: null,
              }
            }
            return { read: null, rowsAffected: result.rowsAffected ?? null, tag: null }
          })
        },
        async close() {
          await connection.close()
        },
      }
    },

    beginStatement(level: IsolationLevel) {
      // SET TRANSACTION both starts the transaction and sets its level.
      return `SET TRANSACTION ISOLATION LEVEL ${level}`
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
      const connection = await adminConnection()
      await connection.commit()
      const result = await connection.execute<readonly number[]>('SELECT k, v FROM items ORDER BY k')
      const rows = (result.rows ?? []) as ReadonlyArray<readonly number[]>
      return rows.map((row): InitialRow => ({ key: Number(row[0]), value: Number(row[1]) }))
    },

    async isWaitingOnLock(sessionId: number) {
      const connection = await adminConnection()
      const result = await connection.execute<[number]>(
        `SELECT COUNT(*) FROM v$session
          WHERE sid = ${sessionId} AND blocking_session IS NOT NULL`,
      )
      return Number(result.rows?.[0]?.[0] ?? 0) > 0
    },

    errorAbortsTransaction() {
      // Oracle rolls back the statement, not the transaction: after ORA-08177 or
      // a deadlock the transaction is still open, and a COMMIT commits whatever
      // it had already done.
      return false
    },

    errorCode(error: unknown) {
      if (typeof error === 'object' && error !== null && 'errorNum' in error) {
        return String((error as { errorNum: unknown }).errorNum)
      }
      return 'unknown'
    },

    errorMessage(error: unknown) {
      if (error instanceof Error) return error.message.split('\n')[0] ?? error.message
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
