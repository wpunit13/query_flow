const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export async function parseSql(sql, dialect = 'bigquery') {
  const response = await fetch(`${API_BASE_URL}/api/parse-sql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, dialect }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Server error (${response.status})`);
  }

  return response.json();
}
