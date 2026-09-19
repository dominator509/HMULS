/**
 * Kysely dialect for Better Auth over the app's Neon HTTP client (`getSql`).
 *
 * Cloudflare Workers cannot reliably hold node-postgres / serverless WebSocket
 * Pools (8s TCP hang → empty 500; Pool reuse → CF 1101). App SQL already uses
 * Neon HTTP with AbortError retries — auth must share that path.
 *
 * Transactions are no-ops: each Neon HTTP call is auto-commit on its own
 * short-lived connection. Better Auth email sign-in is dominated by single
 * statements (lookup + optional session insert); that matches Workers.
 */
import {
  CompiledQuery,
  type DatabaseConnection,
  type DatabaseIntrospector,
  type Dialect,
  type Driver,
  type Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type QueryCompiler,
  type QueryResult,
  type TransactionSettings,
} from "kysely";
import { getSql, type Sql } from "../db";

export function neonHttpDialect(): Dialect {
  return {
    createAdapter: () => new PostgresAdapter(),
    createDriver: () => new NeonHttpDriver(),
    createQueryCompiler: (): QueryCompiler => new PostgresQueryCompiler(),
    createIntrospector: (db: Kysely<unknown>): DatabaseIntrospector =>
      new PostgresIntrospector(db),
  };
}

class NeonHttpDriver implements Driver {
  private connection: NeonHttpConnection | undefined;
  private queue: Array<(con: NeonHttpConnection) => void> = [];

  async init(): Promise<void> {
    await getSql();
  }

  async acquireConnection(): Promise<DatabaseConnection> {
    if (this.connection !== undefined) {
      return new Promise((resolve) => {
        this.queue.push(resolve);
      });
    }
    this.connection = new NeonHttpConnection();
    return this.connection;
  }

  async releaseConnection(connection: DatabaseConnection): Promise<void> {
    if (connection !== this.connection) {
      throw new Error("Invalid connection");
    }
    const next = this.queue.shift();
    if (next === undefined) {
      this.connection = undefined;
      return;
    }
    next(this.connection);
  }

  async beginTransaction(
    _conn: DatabaseConnection,
    _settings: TransactionSettings,
  ): Promise<void> {
    // Neon HTTP: no session — Better Auth statements run auto-commit.
  }

  async commitTransaction(_conn: DatabaseConnection): Promise<void> {}

  async rollbackTransaction(_conn: DatabaseConnection): Promise<void> {}

  async destroy(): Promise<void> {
    this.connection = undefined;
    this.queue = [];
  }
}

class NeonHttpConnection implements DatabaseConnection {
  async executeQuery<O>(compiledQuery: CompiledQuery): Promise<QueryResult<O>> {
    const sql: Sql = await getSql();
    const rows = await sql.query<O>(compiledQuery.sql, [
      ...compiledQuery.parameters,
    ]);
    return { rows };
  }

  async *streamQuery<O>(
    compiledQuery: CompiledQuery,
    chunkSize: number,
  ): AsyncIterableIterator<QueryResult<O>> {
    if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
      throw new Error("chunkSize must be a positive integer");
    }
    const result = await this.executeQuery<O>(compiledQuery);
    for (let i = 0; i < result.rows.length; i += chunkSize) {
      yield { rows: result.rows.slice(i, i + chunkSize) };
    }
  }
}
