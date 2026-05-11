export const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
  "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho",
  "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana",
  "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota",
  "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada",
  "New Hampshire", "New Jersey", "New Mexico", "New York",
  "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon",
  "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
  "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
  "West Virginia", "Wisconsin", "Wyoming",
];

export const STATE_ABBREVIATIONS = {
  AL: "Alabama",    AK: "Alaska",       AZ: "Arizona",      AR: "Arkansas",
  CA: "California", CO: "Colorado",     CT: "Connecticut",  DE: "Delaware",
  FL: "Florida",    GA: "Georgia",      HI: "Hawaii",       ID: "Idaho",
  IL: "Illinois",   IN: "Indiana",      IA: "Iowa",         KS: "Kansas",
  KY: "Kentucky",   LA: "Louisiana",    ME: "Maine",        MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan",  MN: "Minnesota",    MS: "Mississippi",
  MO: "Missouri",   MT: "Montana",      NE: "Nebraska",     NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico",  NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio",     OK: "Oklahoma",
  OR: "Oregon",     PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee",  TX: "Texas",        UT: "Utah",
  VT: "Vermont",    VA: "Virginia",     WA: "Washington",   WV: "West Virginia",
  WI: "Wisconsin",  WY: "Wyoming",
};

export function normalizeState(state) {
  if (!state) return null;
  const cleaned = state.trim();
  if (US_STATES.includes(cleaned)) return cleaned;
  return STATE_ABBREVIATIONS[cleaned.toUpperCase()] || cleaned;
}

export function isUSLocation(record) {
  const city    = record.city?.trim();
  const state   = normalizeState(record.state);
  const country = record.country?.trim().toLowerCase();

  const isUS =
    country === "united states" ||
    country === "usa"           ||
    country === "us"            ||
    country === "u.s."          ||
    country === "u.s.a.";

  if (!isUS)                               return false;
  if (!city || city.length < 2)            return false;
  if (!state || !US_STATES.includes(state)) return false;

  record.state   = state;
  record.country = "United States";
  return true;
}
