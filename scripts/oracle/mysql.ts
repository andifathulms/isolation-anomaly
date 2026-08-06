import mysql from 'mysql2/promise'
import type { InitialRow, Operation } from '../../lib/schedule'
import { toSql } from '../../lib/schedule'
import type { OracleDriver, OracleSession, ReadShape, StatementResult } from './driver'

const CONNECTION = {
  host: '127.0.0.1',
  port: 55336,
  user: 'root',
  password: 'oracle',
  database: 'oracle',
  // One statement per call, so a schedule step is a schedule step.
  multipleStatements: false,
} as const

/**
 * MySQL 8.4 with InnoDB in a container.
 *
 * Autocommit is switched off on every session, which matters: InnoDB only
 * promotes plain SELECT to SELECT ... FOR SHARE at SERIALIZABLE when autocommit
 * is disabled, and that promotion is the whole character of the level.
 *
 * The level is set on the session when it is opened, so each recorded run
 * starts from a known level rather than inheriting whatever the server default
 * happens to be.
 */
export function createMysqlDriver(): OracleDriver {
  let admin: mysql.Connection | null = null

  async function adminConnection(): Promise<mysql.Connection> {
    if (!admin) admin = await mysql.createConnection(CONNECTION)
    return admin
  }

  return {
    packId: 'mysql-8-innodb',
    engine: 'MySQL InnoDB',
    image: 'mysql:8.4',
    service: 'mysql',

    async serverVersion() {
      const connection = await adminConnection()
      const [rows] = await connection.query<mysql.RowDataPacket[]>('SELECT VERSION() AS version')
      return String(rows[0]?.version ?? 'unknown')
    },

    async reset(rows) {
      const connection = await adminConnection()
      await connection.query('DROP TABLE IF EXISTS items')
      await connection.query('CREATE TABLE items (k INT PRIMARY KEY, v INT NOT NULL) ENGINE=InnoDB')
      for (const row of rows) {
        await connection.query('INSERT INTO items (k, v) VALUES (?, ?)', [row.key, row.value])
      }
    },

    async openSession(txn, level): Promise<OracleSession> {
      const connection = await mysql.createConnection(CONNECTION)
      // Autocommit off is required for InnoDB to promote plain SELECT to
      // SELECT ... FOR SHARE at SERIALIZABLE, and that promotion is the whole
      // character of the level.
      await connection.query('SET autocommit = 0')
      await connection.query(`SET SESSION TRANSACTION ISOLATION LEVEL ${level}`)
      const [idRows] = await connection.query<mysql.RowDataPacket[]>(
        'SELECT CONNECTION_ID() AS id',
      )
      return {
        txn,
        id: Number(idRows[0]?.id ?? 0),
        send(statement: string, expect: ReadShape): Promise<StatementResult> {
          return connection.query(statement).then(([result]): StatementResult => {
            if (expect === 'rows') {
              const rows = result as mysql.RowDataPacket[]
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
              const rows = result as mysql.RowDataPacket[]
              const first = rows[0]
              return {
                read: { type: 'row', value: first === undefined ? null : Number(first.v) },
                rowsAffected: null,
                tag: null,
              }
            }
            const header = result as mysql.ResultSetHeader
            return {
              read: null,
              rowsAffected: typeof header.affectedRows === 'number' ? header.affectedRows : null,
              tag: null,
            }
          })
        },
        async close() {
          await connection.end()
        },
      }
    },

    beginStatement() {
      // The level was set on the session when it was opened.
      return 'BEGIN'
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
      // The admin connection has its own transaction; start a fresh one so it
      // reads the committed state rather than a stale snapshot.
      await connection.query('COMMIT')
      const [rows] = await connection.query<mysql.RowDataPacket[]>(
        'SELECT k, v FROM items ORDER BY k',
      )
      return rows.map((row): InitialRow => ({ key: Number(row.k), value: Number(row.v) }))
    },

    async isWaitingOnLock(sessionId: number) {
      const connection = await adminConnection()
      const [rows] = await connection.query<mysql.RowDataPacket[]>(
        `SELECT COUNT(*) AS waiting
           FROM performance_schema.data_lock_waits w
           JOIN performance_schema.threads t ON t.thread_id = w.requesting_thread_id
          WHERE t.processlist_id = ?`,
        [sessionId],
      )
      return Number(rows[0]?.waiting ?? 0) > 0
    },

    errorAbortsTransaction(code: string) {
      // ER_LOCK_DEADLOCK rolls the transaction back; ER_LOCK_WAIT_TIMEOUT and
      // ordinary statement errors do not, and the transaction carries on.
      return code === '1213'
    },

    errorCode(error: unknown) {
      if (typeof error === 'object' && error !== null && 'errno' in error) {
        return String((error as { errno: unknown }).errno)
      }
      return 'unknown'
    },

    errorMessage(error: unknown) {
      if (typeof error === 'object' && error !== null && 'sqlMessage' in error) {
        return String((error as { sqlMessage: unknown }).sqlMessage)
      }
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
