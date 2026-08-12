import { API_BASE_URL } from "../config/api";

const normalizeBranchName = (value) => String(value || "").trim();

const sortBranchNames = (names) =>
  [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

export const uniqueBranchNames = (names = []) => {
  const unique = new Set();
  names.forEach((name) => {
    const normalized = normalizeBranchName(name);
    if (normalized) {
      unique.add(normalized);
    }
  });
  return sortBranchNames(Array.from(unique));
};

export const extractBranchNamesFromLocations = (locations = []) => {
  if (!Array.isArray(locations)) return [];
  return uniqueBranchNames(locations.map((location) => location?.name));
};

export const withAllBranchesOption = (names = []) => ["All", ...uniqueBranchNames(names)];

export async function fetchBranchesFromLocationSet(clientId) {
  const query = clientId ? `?clientId=${encodeURIComponent(clientId)}` : "";
  const response = await fetch(`${API_BASE_URL}/api/locations${query}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch locations: ${response.status}`);
  }
  const locations = await response.json();
  return extractBranchNamesFromLocations(locations);
}
