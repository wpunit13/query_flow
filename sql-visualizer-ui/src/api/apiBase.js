/**
 * API base URL for fetch calls.
 * - Dev (Vite): defaults to http://127.0.0.1:8000 (backend on separate port)
 * - Docker / production: empty VITE_API_URL at build → same-origin (window.location)
 * - Override anytime via VITE_API_URL in .env or docker build
 */
export function getApiBaseUrl() {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && String(envUrl).trim().length > 0) {
    return String(envUrl).replace(/\/$/, '');
  }
  if (import.meta.env.PROD && typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'http://127.0.0.1:8000';
}
