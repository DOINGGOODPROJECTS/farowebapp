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
