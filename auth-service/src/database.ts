import { Pool, QueryResult, QueryResultRow } from 'pg';

export class PgDatabase {
  constructor(private readonly pool: Pool) {}

  async execute<T extends QueryResultRow = any>(sql: string, params: any[] = []): Promise<[T[], { affectedRows: number }]> {
    const result = await this.pool.query<T>(this.toPostgresSql(sql), params);
    return [result.rows, { affectedRows: result.rowCount ?? 0 }];
  }

  async query<T extends QueryResultRow = any>(sql: string, params: any[] = []): Promise<[T[], QueryResult<T>]> {
    const result = await this.pool.query<T>(this.toPostgresSql(sql), params);
    return [result.rows, result];
  }

  private toPostgresSql(sql: string): string {
    let index = 0;
    return sql.replace(/\?/g, () => `$${++index}`);
  }
}
