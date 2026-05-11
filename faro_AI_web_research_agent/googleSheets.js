import { google } from "googleapis";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getAuthClient } from "./googleAuth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.join(__dirname, ".env.local");

const SHEET_TITLE = "FARO_DATASET";
const ALL_TECH_FOLDER_ID = process.env.GOOGLE_FOLDER_ID || "1AygChtmflL2X4P-_Q_WjG2Kil8braHif";

// ── Column definitions in order (must match Excel layout)
const GROUP_ROW = [
  // CORE (17 cols)
  "CORE", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "",
  // CITY ECONOMIC DATA (7 cols)
  "CITY ECONOMIC DATA", "", "", "", "", "", "",
  // BUSINESS ECOSYSTEM (6 cols)
  "BUSINESS ECOSYSTEM", "", "", "", "", "",
  // GRANTS & FUNDING (8 cols)
  "GRANTS & FUNDING", "", "", "", "", "", "", "",
  // POLICY INCENTIVES (4 cols)
  "POLICY INCENTIVES", "", "", "",
  // COST & RELOCATION DATA (4 cols)
  "COST & RELOCATION DATA", "", "", "",
];

const HEADER_ROW = [
  // CORE
  "ID", "Category", "Title", "Location", "City", "State", "Country",
  "Description", "Source URL", "Source Name", "Confidence Score",
  "Confidence Level", "Status", "Date Fetched", "Last Verified",
  "Created At", "Updated At",
  // CITY ECONOMIC DATA
  "Cost of Living", "Housing & Rent Estimates", "Median Income",
  "Employment Indicators", "Industry Strengths", "Business Environment",
  "Minority Representation (%)",
  // BUSINESS ECOSYSTEM
  "Incubators & Accelerators", "Coworking Spaces", "Startup Hubs",
  "Mentorship Networks", "Chambers of Commerce", "Black Business Organizations",
  // GRANTS & FUNDING
  "Grant Name", "Funder", "Eligibility Criteria", "Funding Amount",
  "Deadline", "Application Link", "Geographic Scope", "Target Audience",
  // POLICY INCENTIVES
  "Tax Incentives", "Startup Support Programs",
  "Minority Business Certifications", "Government-Backed Initiatives",
  // COST & RELOCATION DATA
  "Living Expenses", "Business Setup Costs", "Hiring Costs",
  "Utilities & Infrastructure",
];

function stringify(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function flattenData(data = {}) {
  const d = data;
  const minority =
    stringify(d.minority_representation) ||
    stringify(d.demographics?.minority_representation);

  return [
    // city_economic_data
    stringify(d.cost_of_living),
    stringify(d.housing_rent_estimates),
    stringify(d.median_income),
    stringify(d.employment_indicators),
    stringify(d.industry_strengths),
    stringify(d.business_environment),
    minority,
    // business_ecosystem
    stringify(d.incubators_accelerators),
    stringify(d.coworking_spaces),
    stringify(d.startup_hubs),
    stringify(d.mentorship_networks),
    stringify(d.chambers_of_commerce),
    stringify(d.black_business_organizations),
    // grants_funding
    stringify(d.grant_name),
    stringify(d.funder),
    stringify(d.eligibility_criteria),
    stringify(d.funding_amount),
    stringify(d.deadline),
    stringify(d.application_link),
    stringify(d.geographic_scope),
    stringify(d.target_audience),
    // policy_incentives
    stringify(d.tax_incentives),
    stringify(d.startup_support_programs),
    stringify(d.minority_business_certifications),
    stringify(d.government_backed_initiatives),
    // cost_relocation_data
    stringify(d.living_expenses),
    stringify(d.business_setup_costs),
    stringify(d.hiring_costs),
    stringify(d.utilities_and_infrastructure),
  ];
}

function saveSheetId(sheetId) {
  let envContent = fs.existsSync(ENV_PATH)
    ? fs.readFileSync(ENV_PATH, "utf8")
    : "";
  if (/^GOOGLE_SHEET_ID=.*/m.test(envContent)) {
    envContent = envContent.replace(
      /^GOOGLE_SHEET_ID=.*/m,
      `GOOGLE_SHEET_ID=${sheetId}`
    );
  } else {
    envContent = envContent.trimEnd() + `\nGOOGLE_SHEET_ID=${sheetId}\n`;
  }
  fs.writeFileSync(ENV_PATH, envContent);
}

async function getOrCreateSheet(sheets, drive) {
  const existingId = process.env.GOOGLE_SHEET_ID;

  if (existingId) {
    return existingId;
  }

  // Create a new spreadsheet
  const created = await sheets.spreadsheets.create({
    resource: {
      properties: { title: SHEET_TITLE },
      sheets: [{ properties: { title: "Records" } }],
    },
  });

  const spreadsheetId = created.data.spreadsheetId;
  const sheetId = created.data.sheets[0].properties.sheetId;
  saveSheetId(spreadsheetId);
  process.env.GOOGLE_SHEET_ID = spreadsheetId;

  // Move into the ALL TECH shared folder
  const currentFile = await drive.files.get({ fileId: spreadsheetId, fields: "parents", supportsAllDrives: true });
  const prevParents = (currentFile.data.parents || []).join(",");
  await drive.files.update({
    fileId: spreadsheetId,
    addParents: ALL_TECH_FOLDER_ID,
    removeParents: prevParents,
    supportsAllDrives: true,
    fields: "id, parents",
  });

  // Write the two header rows
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "Records!A1",
    valueInputOption: "RAW",
    resource: { values: [GROUP_ROW, HEADER_ROW] },
  });

  // Freeze rows 1 & 2
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    resource: {
      requests: [
        {
          updateSheetProperties: {
            properties: {
              sheetId,
              gridProperties: { frozenRowCount: 2 },
            },
            fields: "gridProperties.frozenRowCount",
          },
        },
      ],
    },
  });

  console.log(`  Google Sheet created: https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
  return spreadsheetId;
}

export async function appendRowToSheet(id, record) {
  const auth = getAuthClient();
  const sheets = google.sheets({ version: "v4", auth });
  const drive  = google.drive({ version: "v3", auth });

  const spreadsheetId = await getOrCreateSheet(sheets, drive);

  const now = new Date().toISOString();
  const coreFields = [
    id,
    record.category,
    record.title,
    record.location       ?? "",
    record.city           ?? "",
    record.state          ?? "",
    record.country        ?? "",
    record.description    ?? "",
    record.source_url     ?? "",
    record.source_name    ?? "",
    record.confidence_score  ?? "",
    record.confidence_level  ?? "",
    record.status         ?? "",
    now,   // date_fetched
    now,   // last_verified
    now,   // created_at
    now,   // updated_at
  ];

  const dataFields = flattenData(record.data);
  const row = [...coreFields, ...dataFields];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "Records!A3",
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    resource: { values: [row] },
  });

  const sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
  console.log(`  Row added to Google Sheet: ${sheetUrl}`);
}
