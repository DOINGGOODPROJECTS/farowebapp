import { cities, type City } from "@/lib/data";
import CityDetailClient from "./CityDetailClient";

export function generateStaticParams() {
  return cities.map((city) => ({ slug: city.slug }));
}

export default async function CityDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const normalizeSlug = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const { slug } = await params;
  const rawSlug = decodeURIComponent(slug || "");
  const normalizedSlug = normalizeSlug(rawSlug);

  const city =
    cities.find((item) => item.slug === rawSlug) ||
    cities.find((item) => item.slug === normalizedSlug) ||
    cities.find(
      (item) =>
        normalizeSlug(`${item.name}-${item.state}`) === normalizedSlug
    );

  if (!city) {
    const fallbackName = rawSlug
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
    const fallbackCity: City = {
      slug: normalizedSlug || "city",
      name: fallbackName || "City",
      state: rawSlug.split("-").pop()?.toUpperCase() || "NA",
      country: "Unknown",
      region: "Unknown",
      regionCode: "unknown",
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
    };

    return <CityDetailClient city={fallbackCity} />;
  }

  return <CityDetailClient city={city} />;
}
