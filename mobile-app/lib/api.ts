type QueryValue = string | number | boolean | null | undefined;

const DEFAULT_API_BASE_URL = "https://iie.zentime.co.in";

function normalizeBaseUrl(rawBaseUrl?: string | null): string {
  return String(rawBaseUrl || "").trim().replace(/\s+/g, "").replace(/\/+$/, "");
}

export const API_BASE_URL = normalizeBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL) || DEFAULT_API_BASE_URL;

export function resolveAssetUrl(rawUrl?: string | null): string {
  const value = (rawUrl || "").trim();
  if (!value) {
    return "";
  }

  if (value.startsWith("data:") || value.startsWith("file://")) {
    return value;
  }

  if (/^employees\/profile\//i.test(value)) {
    return `${API_BASE_URL}/api/employees/image/${value}`;
  }

  // Backend may return localhost links that are unreachable from real devices.
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(value)) {
    try {
      const parsed = new URL(value);
      return `${API_BASE_URL}${parsed.pathname}${parsed.search}`;
    } catch {
      return value;
    }
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (/^[^/]+\.(?:jpe?g|png|gif|webp)$/i.test(value)) {
    return `${API_BASE_URL}/api/employees/image/${value}`;
  }

  const normalizedPath = value.startsWith("/") ? value : `/${value}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

export function buildApiUrl(
  path: string,
  options?: {
    clientId?: number | string | null;
    query?: Record<string, QueryValue>;
  }
): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${API_BASE_URL}${normalizedPath}`);

  if (options?.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined && value !== null && `${value}`.length > 0) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  if (options?.clientId !== undefined && options?.clientId !== null && `${options.clientId}`.length > 0) {
    url.searchParams.set("clientId", String(options.clientId));
  }

  return url.toString();
}

export function withClientId<T extends Record<string, unknown>>(params: T, clientId?: number | string | null): T {
  if (clientId === undefined || clientId === null || `${clientId}`.length === 0) {
    return params;
  }
  return { ...params, clientId };
}
