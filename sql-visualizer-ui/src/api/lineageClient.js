import { ParseSqlError } from './parseErrors';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export async function parseSql(sql, dialect = 'bigquery') {
  const response = await fetch(`${API_BASE_URL}/api/parse-sql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, dialect }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const parseError = ParseSqlError.fromResponse(body.detail);
    if (parseError) throw parseError;

    const message =
      typeof body.detail === 'string'
        ? body.detail
        : body.detail?.message || `Server error (${response.status})`;
    throw new Error(message);
  }

  return response.json();
}
