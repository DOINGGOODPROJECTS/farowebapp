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

// 54 African countries with their primary entrepreneurship city
export const AFRICAN_LOCATIONS = {
  "Algeria":                    "Algiers",
  "Angola":                     "Luanda",
  "Benin":                      "Cotonou",
  "Botswana":                   "Gaborone",
  "Burkina Faso":               "Ouagadougou",
  "Burundi":                    "Bujumbura",
  "Cabo Verde":                 "Praia",
  "Cameroon":                   "Douala",
  "Central African Republic":   "Bangui",
  "Chad":                       "N'Djamena",
  "Comoros":                    "Moroni",
  "Republic of the Congo":      "Pointe-Noire",
  "DR Congo":                   "Kinshasa",
  "Côte d'Ivoire":              "Abidjan",
  "Djibouti":                   "Djibouti City",
  "Egypt":                      "Cairo",
  "Equatorial Guinea":          "Malabo",
  "Eritrea":                    "Asmara",
  "Eswatini":                   "Manzini",
  "Ethiopia":                   "Addis Ababa",
  "Gabon":                      "Libreville",
  "Gambia":                     "Serekunda",
  "Ghana":                      "Accra",
  "Guinea":                     "Conakry",
  "Guinea-Bissau":              "Bissau",
  "Kenya":                      "Nairobi",
  "Lesotho":                    "Maseru",
  "Liberia":                    "Monrovia",
  "Libya":                      "Tripoli",
  "Madagascar":                 "Antananarivo",
  "Malawi":                     "Blantyre",
  "Mali":                       "Bamako",
  "Mauritania":                 "Nouakchott",
  "Mauritius":                  "Port Louis",
  "Morocco":                    "Casablanca",
  "Mozambique":                 "Maputo",
  "Namibia":                    "Windhoek",
  "Niger":                      "Niamey",
  "Nigeria":                    "Lagos",
  "Rwanda":                     "Kigali",
  "São Tomé & Príncipe":        "São Tomé",
  "Senegal":                    "Dakar",
  "Seychelles":                 "Victoria",
  "Sierra Leone":               "Freetown",
  "Somalia":                    "Mogadishu",
  "South Africa":               "Johannesburg",
  "South Sudan":                "Juba",
  "Sudan":                      "Khartoum",
  "Tanzania":                   "Dar es Salaam",
  "Togo":                       "Lomé",
  "Tunisia":                    "Tunis",
  "Uganda":                     "Kampala",
  "Zambia":                     "Lusaka",
  "Zimbabwe":                   "Harare",
};

export const AFRICAN_COUNTRIES   = new Set(Object.keys(AFRICAN_LOCATIONS));
export const AFRICAN_CITIES      = new Set(Object.values(AFRICAN_LOCATIONS));

export function normalizeState(state) {
  if (!state) return null;
  const cleaned = state.trim();
  if (US_STATES.includes(cleaned)) return cleaned;
  return STATE_ABBREVIATIONS[cleaned.toUpperCase()] || cleaned;
}

export function isUSLocation(record) {
  return isKnownLocation(record) && record.country === "United States";
}

export function isKnownLocation(record) {
  const city    = record.city?.trim();
  const country = record.country?.trim();
  const countryLc = country?.toLowerCase() ?? '';

  // ── United States ──
  const isUS =
    countryLc === "united states" ||
    countryLc === "usa"           ||
    countryLc === "us"            ||
    countryLc === "u.s."          ||
    countryLc === "u.s.a.";

  if (isUS) {
    if (!city || city.length < 2) return false;
    const state = normalizeState(record.state);
    if (!state || !US_STATES.includes(state)) return false;
    record.state   = state;
    record.country = "United States";
    return true;
  }

  // ── Africa ──
  const matchedCountry = [...AFRICAN_COUNTRIES].find(
    (c) => c.toLowerCase() === countryLc,
  );
  if (matchedCountry) {
    if (!city || city.length < 2) return false;
    record.country = matchedCountry;
    record.state   = record.state || '';
    return true;
  }

  return false;
}
