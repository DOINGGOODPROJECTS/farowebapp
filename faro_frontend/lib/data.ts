export type City = {
  slug: string;
  name: string;
  state: string;
  country: string;
  region: string;
  regionCode: string;
  population: string;
  medianIncome: string;
  costIndex: number;
  businessScore: number;
  blackPopulationPct: number;
  opportunityScore: number;
  highlights: string[];
  incentives: string[];
  industries: string[];
  grants: { name: string; deadline: string; amount: string }[];
  networkStrength: number;
  housingIndex: number;
  climate: string;
};

const makeSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const makeCity = ({
  name,
  state,
  country,
  region,
  regionCode,
}: {
  name: string;
  state: string;
  country: string;
  region: string;
  regionCode: string;
}): City => ({
  slug: makeSlug(`${name}-${state || country}`),
  name,
  state,
  country,
  region,
  regionCode,
  population: "N/A",
  medianIncome: "N/A",
  costIndex: 0,
  businessScore: 0,
  blackPopulationPct: 0,
  opportunityScore: 0,
  highlights: ["Profile details coming soon."],
  incentives: ["Incentive data coming soon."],
  industries: ["Industry data coming soon."],
  grants: [
    {
      name: "Grant data coming soon",
      deadline: "TBD",
      amount: "TBD",
    },
  ],
  networkStrength: 0,
  housingIndex: 0,
  climate: "N/A",
});

export const cities: City[] = [
  // U.S. South
  makeCity({
    name: "Atlanta",
    state: "GA",
    country: "United States",
    region: "U.S. South",
    regionCode: "us_south",
  }),
  makeCity({
    name: "Houston",
    state: "TX",
    country: "United States",
    region: "U.S. South",
    regionCode: "us_south",
  }),
  makeCity({
    name: "Dallas",
    state: "TX",
    country: "United States",
    region: "U.S. South",
    regionCode: "us_south",
  }),
  makeCity({
    name: "Charlotte",
    state: "NC",
    country: "United States",
    region: "U.S. South",
    regionCode: "us_south",
  }),
  makeCity({
    name: "Raleigh",
    state: "NC",
    country: "United States",
    region: "U.S. South",
    regionCode: "us_south",
  }),
  makeCity({
    name: "Durham",
    state: "NC",
    country: "United States",
    region: "U.S. South",
    regionCode: "us_south",
  }),
  makeCity({
    name: "Memphis",
    state: "TN",
    country: "United States",
    region: "U.S. South",
    regionCode: "us_south",
  }),
  // DMV
  makeCity({
    name: "Washington",
    state: "DC",
    country: "United States",
    region: "DMV",
    regionCode: "us_dmv",
  }),
  makeCity({
    name: "Silver Spring",
    state: "MD",
    country: "United States",
    region: "DMV",
    regionCode: "us_dmv",
  }),
  makeCity({
    name: "Hyattsville",
    state: "MD",
    country: "United States",
    region: "DMV",
    regionCode: "us_dmv",
  }),
  makeCity({
    name: "Bowie",
    state: "MD",
    country: "United States",
    region: "DMV",
    regionCode: "us_dmv",
  }),
  makeCity({
    name: "Alexandria",
    state: "VA",
    country: "United States",
    region: "DMV",
    regionCode: "us_dmv",
  }),
  // Midwest
  makeCity({
    name: "Chicago",
    state: "IL",
    country: "United States",
    region: "U.S. Midwest",
    regionCode: "us_midwest",
  }),
  makeCity({
    name: "Detroit",
    state: "MI",
    country: "United States",
    region: "U.S. Midwest",
    regionCode: "us_midwest",
  }),
  makeCity({
    name: "Columbus",
    state: "OH",
    country: "United States",
    region: "U.S. Midwest",
    regionCode: "us_midwest",
  }),
  makeCity({
    name: "Minneapolis",
    state: "MN",
    country: "United States",
    region: "U.S. Midwest",
    regionCode: "us_midwest",
  }),
  makeCity({
    name: "St. Louis",
    state: "MO",
    country: "United States",
    region: "U.S. Midwest",
    regionCode: "us_midwest",
  }),

  // North Africa
  makeCity({ name: "Algiers",      state: "", country: "Algeria",                  region: "North Africa",   regionCode: "africa_north" }),
  makeCity({ name: "Cairo",        state: "", country: "Egypt",                    region: "North Africa",   regionCode: "africa_north" }),
  makeCity({ name: "Tripoli",      state: "", country: "Libya",                    region: "North Africa",   regionCode: "africa_north" }),
  makeCity({ name: "Casablanca",   state: "", country: "Morocco",                  region: "North Africa",   regionCode: "africa_north" }),
  makeCity({ name: "Khartoum",     state: "", country: "Sudan",                    region: "North Africa",   regionCode: "africa_north" }),
  makeCity({ name: "Tunis",        state: "", country: "Tunisia",                  region: "North Africa",   regionCode: "africa_north" }),

  // West Africa
  makeCity({ name: "Cotonou",      state: "", country: "Benin",                    region: "West Africa",    regionCode: "africa_west" }),
  makeCity({ name: "Ouagadougou",  state: "", country: "Burkina Faso",             region: "West Africa",    regionCode: "africa_west" }),
  makeCity({ name: "Praia",        state: "", country: "Cabo Verde",               region: "West Africa",    regionCode: "africa_west" }),
  makeCity({ name: "Abidjan",      state: "", country: "Côte d'Ivoire",            region: "West Africa",    regionCode: "africa_west" }),
  makeCity({ name: "Serekunda",    state: "", country: "Gambia",                   region: "West Africa",    regionCode: "africa_west" }),
  makeCity({ name: "Accra",        state: "", country: "Ghana",                    region: "West Africa",    regionCode: "africa_west" }),
  makeCity({ name: "Conakry",      state: "", country: "Guinea",                   region: "West Africa",    regionCode: "africa_west" }),
  makeCity({ name: "Bissau",       state: "", country: "Guinea-Bissau",            region: "West Africa",    regionCode: "africa_west" }),
  makeCity({ name: "Monrovia",     state: "", country: "Liberia",                  region: "West Africa",    regionCode: "africa_west" }),
  makeCity({ name: "Bamako",       state: "", country: "Mali",                     region: "West Africa",    regionCode: "africa_west" }),
  makeCity({ name: "Nouakchott",   state: "", country: "Mauritania",               region: "West Africa",    regionCode: "africa_west" }),
  makeCity({ name: "Niamey",       state: "", country: "Niger",                    region: "West Africa",    regionCode: "africa_west" }),
  makeCity({ name: "Lagos",        state: "Lagos State", country: "Nigeria",       region: "West Africa",    regionCode: "africa_west" }),
  makeCity({ name: "São Tomé",     state: "", country: "São Tomé & Príncipe",      region: "West Africa",    regionCode: "africa_west" }),
  makeCity({ name: "Dakar",        state: "", country: "Senegal",                  region: "West Africa",    regionCode: "africa_west" }),
  makeCity({ name: "Freetown",     state: "", country: "Sierra Leone",             region: "West Africa",    regionCode: "africa_west" }),
  makeCity({ name: "Lomé",         state: "", country: "Togo",                     region: "West Africa",    regionCode: "africa_west" }),

  // East Africa
  makeCity({ name: "Bujumbura",    state: "", country: "Burundi",                  region: "East Africa",    regionCode: "africa_east" }),
  makeCity({ name: "Moroni",       state: "", country: "Comoros",                  region: "East Africa",    regionCode: "africa_east" }),
  makeCity({ name: "Djibouti City",state: "", country: "Djibouti",                 region: "East Africa",    regionCode: "africa_east" }),
  makeCity({ name: "Asmara",       state: "", country: "Eritrea",                  region: "East Africa",    regionCode: "africa_east" }),
  makeCity({ name: "Addis Ababa",  state: "", country: "Ethiopia",                 region: "East Africa",    regionCode: "africa_east" }),
  makeCity({ name: "Nairobi",      state: "", country: "Kenya",                    region: "East Africa",    regionCode: "africa_east" }),
  makeCity({ name: "Antananarivo", state: "", country: "Madagascar",               region: "East Africa",    regionCode: "africa_east" }),
  makeCity({ name: "Port Louis",   state: "", country: "Mauritius",                region: "East Africa",    regionCode: "africa_east" }),
  makeCity({ name: "Kigali",       state: "", country: "Rwanda",                   region: "East Africa",    regionCode: "africa_east" }),
  makeCity({ name: "Victoria",     state: "", country: "Seychelles",               region: "East Africa",    regionCode: "africa_east" }),
  makeCity({ name: "Mogadishu",    state: "", country: "Somalia",                  region: "East Africa",    regionCode: "africa_east" }),
  makeCity({ name: "Juba",         state: "", country: "South Sudan",              region: "East Africa",    regionCode: "africa_east" }),
  makeCity({ name: "Dar es Salaam",state: "", country: "Tanzania",                 region: "East Africa",    regionCode: "africa_east" }),
  makeCity({ name: "Kampala",      state: "", country: "Uganda",                   region: "East Africa",    regionCode: "africa_east" }),

  // Central Africa
  makeCity({ name: "Douala",       state: "", country: "Cameroon",                 region: "Central Africa", regionCode: "africa_central" }),
  makeCity({ name: "Bangui",       state: "", country: "Central African Republic", region: "Central Africa", regionCode: "africa_central" }),
  makeCity({ name: "N'Djamena",    state: "", country: "Chad",                     region: "Central Africa", regionCode: "africa_central" }),
  makeCity({ name: "Kinshasa",     state: "", country: "DR Congo",                 region: "Central Africa", regionCode: "africa_central" }),
  makeCity({ name: "Malabo",       state: "", country: "Equatorial Guinea",        region: "Central Africa", regionCode: "africa_central" }),
  makeCity({ name: "Libreville",   state: "", country: "Gabon",                    region: "Central Africa", regionCode: "africa_central" }),
  makeCity({ name: "Pointe-Noire", state: "", country: "Republic of the Congo",    region: "Central Africa", regionCode: "africa_central" }),

  // Southern Africa
  makeCity({ name: "Luanda",       state: "", country: "Angola",                   region: "Southern Africa", regionCode: "africa_south" }),
  makeCity({ name: "Gaborone",     state: "", country: "Botswana",                 region: "Southern Africa", regionCode: "africa_south" }),
  makeCity({ name: "Manzini",      state: "", country: "Eswatini",                 region: "Southern Africa", regionCode: "africa_south" }),
  makeCity({ name: "Maseru",       state: "", country: "Lesotho",                  region: "Southern Africa", regionCode: "africa_south" }),
  makeCity({ name: "Blantyre",     state: "", country: "Malawi",                   region: "Southern Africa", regionCode: "africa_south" }),
  makeCity({ name: "Maputo",       state: "", country: "Mozambique",               region: "Southern Africa", regionCode: "africa_south" }),
  makeCity({ name: "Windhoek",     state: "", country: "Namibia",                  region: "Southern Africa", regionCode: "africa_south" }),
  makeCity({ name: "Johannesburg", state: "Gauteng", country: "South Africa",      region: "Southern Africa", regionCode: "africa_south" }),
  makeCity({ name: "Lusaka",       state: "", country: "Zambia",                   region: "Southern Africa", regionCode: "africa_south" }),
  makeCity({ name: "Harare",       state: "", country: "Zimbabwe",                 region: "Southern Africa", regionCode: "africa_south" }),
];

export const notifications = [
  {
    id: "notif-1",
    title: "New grant match: Black Founders Boost",
    category: "Grants",
    time: "2 hours ago",
  },
  {
    id: "notif-2",
    title: "Accra cost of living index updated",
    category: "City Data",
    time: "Yesterday",
  },
  {
    id: "notif-3",
    title: "Mentor match suggestion for fintech founders",
    category: "Network",
    time: "2 days ago",
  },
];
