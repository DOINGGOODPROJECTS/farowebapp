import { normalizeState } from "./usCities.js";

export function normalizeLocation(record) {
  if (!record.location) return record;

  const parts = record.location.split(",").map((p) => p.trim());

  if (!record.city  && parts[0]) record.city  = parts[0];
  if (!record.state && parts[1]) record.state = normalizeState(parts[1]);
  if (!record.country)           record.country = "United States";

  if (record.state) record.state = normalizeState(record.state);

  if (record.city && record.state) {
    record.location = `${record.city}, ${record.state}, United States`;
  }

  return record;
}
