const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export const DEFAULT_DIALECT = 'bigquery';

export async function fetchDialects() {
  const response = await fetch(`${API_BASE_URL}/api/dialects`);
  if (!response.ok) {
    throw new Error(`Failed to load dialects (${response.status})`);
  }
  return response.json();
}

export async function detectDialect(sql) {
  const response = await fetch(`${API_BASE_URL}/api/detect-dialect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql }),
  });
  if (!response.ok) {
    throw new Error(`Dialect detection failed (${response.status})`);
  }
  return response.json();
}
