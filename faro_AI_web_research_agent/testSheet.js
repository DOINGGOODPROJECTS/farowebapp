import { appendRowToSheet } from "./googleSheets.js";

const testRecord = {
  category: "grants_funding",
  title: "Test Grant — Faro AI Sheet Integration",
  location: "Atlanta, Georgia, United States",
  city: "Atlanta",
  state: "Georgia",
  country: "United States",
  description: "This is a test row to verify Google Sheets integration is working.",
  source_url: "https://example.com/test",
  source_name: "Faro AI Test",
  confidence_score: 95,
  confidence_level: "high",
  status: "active",
  data: {
    grant_name: "Test Grant",
    funder: "Faro AI",
    eligibility_criteria: "All underrepresented entrepreneurs",
    funding_amount: "$10,000",
    deadline: "2026-12-31",
    application_link: "https://farosmart.com/apply",
    geographic_scope: "Atlanta, GA",
    target_audience: "Black-owned businesses",
  },
};

console.log("Testing Google Sheets integration...");
try {
  await appendRowToSheet("test-id-001", testRecord);
  console.log("Success! Check your Google Drive for the 'Faro AI Dataset' sheet.");
} catch (err) {
  console.error("Failed:", err.message);
}
process.exit(0);
