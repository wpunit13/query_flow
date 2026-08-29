import { ParseSqlError } from './parseErrors';
import { getApiBaseUrl } from './apiBase';

export async function parseSql(sql, dialect = 'bigquery') {
  const response = await fetch(`${getApiBaseUrl()}/api/v1/parse-sql`, {
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
