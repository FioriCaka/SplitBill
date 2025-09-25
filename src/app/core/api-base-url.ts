export function resolveApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return 'http://localhost:8000/api';
  }
  // 1. Global override
  const anyWin = window as any;
  if (anyWin.__SPLITBILL_API_BASE_URL) {
    return trim(anyWin.__SPLITBILL_API_BASE_URL);
  }
  // 2. localStorage override
  try {
    const stored = localStorage.getItem('apiBaseUrl');
    if (stored) return trim(stored);
  } catch {}

  const host = window.location.hostname;
  // 3. Emulator / localhost mapping:
  if (host === 'localhost' || host === '127.0.0.1' || host === '10.0.2.2') {
    return 'http://10.0.2.2:8000/api';
  }
  // 4. Assume same LAN host at port 8000
  return `http://${host}:8000/api`;
}

function trim(url: string): string {
  return url.replace(/\/$/, '');
}
