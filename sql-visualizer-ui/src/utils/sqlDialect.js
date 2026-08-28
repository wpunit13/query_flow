import {
  PostgreSQL,
  MSSQL,
  StandardSQL,
} from '@codemirror/lang-sql';

/** Best-effort CodeMirror SQL dialect per sqlglot read= id. */
export const CODEMIRROR_SQL_DIALECTS = {
  bigquery: StandardSQL,
  snowflake: StandardSQL,
  postgres: PostgreSQL,
  spark: StandardSQL,
  redshift: PostgreSQL,
  duckdb: PostgreSQL,
};

export function getCodeMirrorSqlDialect(dialectId) {
  return CODEMIRROR_SQL_DIALECTS[dialectId] || StandardSQL;
}
