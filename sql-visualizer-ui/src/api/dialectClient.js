import { getApiBaseUrl } from './apiBase';

export const DEFAULT_DIALECT = 'bigquery';

export async function fetchDialects() {
  const response = await fetch(`${getApiBaseUrl()}/api/v1/dialects`);
  if (!response.ok) {
    throw new Error(`Failed to load dialects (${response.status})`);
  }
  return response.json();
}

export async function detectDialect(sql) {
  const response = await fetch(`${getApiBaseUrl()}/api/v1/detect-dialect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql }),
  });
  if (!response.ok) {
    throw new Error(`Dialect detection failed (${response.status})`);
  }
  return response.json();
}
