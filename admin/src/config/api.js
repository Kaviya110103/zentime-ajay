import axios from "axios";

const DEFAULT_API_BASE_URL = "https://iie.zentime.co.in";

const normalizeApiBaseUrl = (value) => {
  const trimmed = String(value || DEFAULT_API_BASE_URL).trim().replace(/\/$/, "");
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

export const API_BASE_URL = normalizeApiBaseUrl(process.env.REACT_APP_API_BASE_URL);
export const API_REQUEST_TIMEOUT_MS = 15000;

export const resolveBackendAssetUrl = (rawUrl) => {
  const value = typeof rawUrl === "string" ? rawUrl.trim() : "";
  if (!value) return "";
  if (/^data:image\//i.test(value)) return value;
  if (/^employees\/profile\//i.test(value)) {
    return `${API_BASE_URL}/api/employees/image/${value}`;
  }
  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      if (parsed.protocol === "http:" || parsed.hostname !== new URL(API_BASE_URL).hostname) {
        return `${API_BASE_URL}${parsed.pathname}${parsed.search}`;
      }
      return value;
    } catch (_error) {
      return value.replace(/^http:\/\//i, "https://");
    }
  }
  if (/^[^/]+\.(?:jpe?g|png|gif|webp)$/i.test(value)) {
    return `${API_BASE_URL}/api/employees/image/${value}`;
  }
  return `${API_BASE_URL}${value.startsWith("/") ? value : `/${value}`}`;
};

axios.defaults.timeout = API_REQUEST_TIMEOUT_MS;

export const fetchWithTimeout = (url, options = {}, timeoutMs = API_REQUEST_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: options.signal || controller.signal })
    .finally(() => clearTimeout(timer));
};
