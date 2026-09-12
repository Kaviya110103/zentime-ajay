import { API_BASE_URL, buildApiUrl, resolveAssetUrl } from './api';

export type AdminRequestOptions = {
  method?: string;
  body?: unknown;
  timeoutMs?: number;
  query?: Record<string, string | number | boolean | null | undefined>;
  clientId?: number | string | null;
};

export async function adminRequest<T>(path: string, options: AdminRequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 10000);
  const url = buildApiUrl(path, { clientId: options.clientId, query: options.query });

  try {
    const response = await fetch(url, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    const text = await response.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!response.ok) {
      const message =
        (data && typeof data === 'object' && (data.message || data.error)) ||
        (typeof data === 'string' && data) ||
        `Request failed with HTTP ${response.status}`;
      throw new Error(String(message));
    }

    return data as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Server took too long to respond. Please try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchAdminBranches(clientId: number): Promise<string[]> {
  const locations = await adminRequest<any[]>('/api/locations', { clientId });
  const names = new Set<string>();
  locations.forEach((location) => {
    const name = String(location?.name || '').trim();
    if (name) names.add(name);
  });
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

export function getDisplayName(value: any): string {
  const direct = String(value?.name || '').trim();
  if (direct) return direct;
  const combined = [value?.firstName, value?.lastName]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' ');
  return combined || value?.username || 'Unknown';
}

export { API_BASE_URL, resolveAssetUrl };
