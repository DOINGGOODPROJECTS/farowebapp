/**
 * sheetRag.ts — RAG layer powered by the Faro Google Sheet (master dataset).
 *
 * Reads all city profiles from the sheet, caches them in-memory for 1 hour,
 * then finds the most relevant profiles for a given question and returns
 * a compact context string to inject into the AI system prompt.
 *
 * The context is used as GUIDANCE — the AI blends this real, researched data
 * with its general knowledge to produce grounded, specific answers.
 *
 * Falls back to empty string if the sheet is not configured or unreachable.
 */

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

// ── Types ─────────────────────────────────────────────────────────────────────

type CityProfile = Record<string, string>;

// ── In-memory cache (1-hour TTL) ──────────────────────────────────────────────

let _profileCache: CityProfile[] | null = null;
let _cacheExpiresAt = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive',
];

// ── Google Sheets auth ────────────────────────────────────────────────────────
// Priority: service account key file → inline JSON key → OAuth2 refresh token

function getAuth() {
  // 1. Service account key file
  const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;
  if (keyFile) {
    const resolved = path.isAbsolute(keyFile) ? keyFile : path.join(process.cwd(), keyFile);
    if (fs.existsSync(resolved)) {
      return new google.auth.GoogleAuth({ keyFile: resolved, scopes: SCOPES });
    }
  }

  // 2. Service account key as inline JSON env var
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (keyJson) {
    try {
      const credentials = JSON.parse(keyJson);
      return new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
    } catch { /* fall through */ }
  }

  // 3. OAuth2 refresh token (legacy)
  const clientId     = process.env.google_oauth;
  const clientSecret = process.env.google_secret;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) return null;

  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });
  return auth;
}

// ── Load city profiles from sheet ────────────────────────────────────────────

async function fetchProfiles(): Promise<CityProfile[]> {
  const auth          = getAuth();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  if (!auth || !spreadsheetId) return [];

  const sheets = google.sheets({ version: 'v4', auth });
  const res    = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Records!A1:AZ',
  });

  const rows = res.data.values || [];
  if (rows.length < 3) return [];

  const headers = rows[1];
  return rows
    .slice(2)
    .map((row) => {
      const p: CityProfile = {};
      headers.forEach((header: string, i: number) => {
        p[header] = (row[i] || '').trim();
      });
      return p;
    })
    .filter((p) => p['City'] && p['City'].length > 0);
}

async function loadProfiles(): Promise<CityProfile[]> {
  const now = Date.now();
  if (_profileCache && now < _cacheExpiresAt) return _profileCache;

  // Try up to 2 times — DNS can fail transiently on first startup
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const profiles   = await fetchProfiles();
      _profileCache    = profiles;
      _cacheExpiresAt  = now + CACHE_TTL_MS;
      console.log(`[sheetRag] Loaded ${profiles.length} city profiles from sheet.`);
      return profiles;
    } catch (err) {
      const msg = String(err);
      const isNetwork = msg.includes('EAI_AGAIN') || msg.includes('ENOTFOUND') || msg.includes('ETIMEDOUT');
      if (attempt === 1 && isNetwork) {
        await new Promise(r => setTimeout(r, 2000)); // wait 2s then retry
        continue;
      }
      // Only log on final failure; return stale cache if available
      console.warn(`[sheetRag] Sheet unavailable — RAG context skipped. (${msg.split('\n')[0]})`);
      return _profileCache ?? [];
    }
  }
  return _profileCache ?? [];
}

// ── Relevance matching ────────────────────────────────────────────────────────

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  grant:       ['grant', 'fund', 'funding', 'money', 'loan', 'capital', 'invest', 'pitch', 'award'],
  cost:        ['cost', 'rent', 'afford', 'cheap', 'expensive', 'living', 'price', 'budget', 'how much'],
  ecosystem:   ['incubator', 'accelerator', 'cowork', 'mentor', 'network', 'hub', 'startup', 'community'],
  jobs:        ['hire', 'hiring', 'wage', 'salary', 'employ', 'job', 'work', 'talent', 'workforce'],
  tax:         ['tax', 'incentive', 'credit', 'deduct', 'zone', 'policy', 'certification', 'license'],
  minority:    ['minority', 'black', 'underrepresented', 'women', 'veteran', 'diversity', 'mbda', 'mbe'],
  relocation:  ['move', 'relocat', 'setup', 'start', 'launch', 'open', 'register', 'utility', 'infrastructure'],
};

function findRelevantProfiles(question: string, profiles: CityProfile[]): CityProfile[] {
  const q = question.toLowerCase();

  // 1. Exact city name match — return that city's full profile
  const cityMatches = profiles.filter(
    (p) => p['City'] && q.includes(p['City'].toLowerCase()),
  );
  if (cityMatches.length > 0) return cityMatches.slice(0, 5);

  // 2. State match
  const stateMatches = profiles.filter(
    (p) => p['State'] && q.includes(p['State'].toLowerCase()),
  );
  if (stateMatches.length > 0) return stateMatches.slice(0, 5);

  // 3. Comparison / "best city for X" — return all profiles (will be summarised)
  const isComparison =
    q.includes('best city') ||
    q.includes('which city') ||
    q.includes('top city') ||
    q.includes('compare') ||
    q.includes('comparison');
  if (isComparison) return profiles;

  // 4. Category keyword — return all profiles so AI can find the best match
  const matchedCategory = Object.entries(CATEGORY_KEYWORDS).find(([, kws]) =>
    kws.some((kw) => q.includes(kw)),
  );
  if (matchedCategory) return profiles;

  // 5. Default — return all profiles
  return profiles;
}

// ── Context builder ───────────────────────────────────────────────────────────

function buildContext(profiles: CityProfile[]): string {
  if (profiles.length === 0) return '';

  // For large sets (all-city comparisons), output a compact summary table
  // instead of full profiles to stay within token budgets.
  const FULL_PROFILE_LIMIT = 6;

  if (profiles.length > FULL_PROFILE_LIMIT) {
    return buildCompactSummary(profiles);
  }

  return profiles
    .map((p) => {
      const lines: string[] = [`=== ${p['City']}, ${p['State']} ===`];

      const add = (label: string, key: string) => {
        if (p[key]) lines.push(`${label}: ${p[key]}`);
      };

      // Economic
      add('Cost of Living',        'Cost of Living');
      add('Cost Index (0-100)',     'Cost Index (0-100)');
      add('Housing & Rent',         'Housing & Rent Estimates');
      add('Housing Index (0-100)',  'Housing Index Score (0-100)');
      add('Median Income',          'Median Income');
      add('Employment',             'Employment Indicators');
      add('Industries',             'Industry Strengths');
      add('Business Environment',   'Business Environment');
      add('Minority Rep (%)',        'Minority Representation (%)');
      add('Underrep. Entrepreneurs','Underrepresented Entrepreneurs (%)');
      add('Opportunity Score',      'Opportunity Score (0-100)');

      // Ecosystem
      add('Incubators/Accelerators','Incubators & Accelerators');
      add('Coworking Spaces',       'Coworking Spaces');
      add('Startup Hubs',           'Startup Hubs');
      add('Mentorship',             'Mentorship Networks');
      add('Network Strength',       'Network Strength (0-100)');
      add('Chamber of Commerce',    'Chambers of Commerce');
      add('Black Business Orgs',    'Black Business Organizations');
      add('Business Score',         'Business Score (0-100)');

      // Grants
      add('Grant',                  'Grant Name');
      add('Funder',                 'Funder');
      add('Eligibility',            'Eligibility Criteria');
      add('Funding Amount',         'Funding Amount');
      add('Deadline',               'Deadline');
      add('Apply',                  'Application Link');
      add('Geographic Scope',       'Geographic Scope');
      add('Target Audience',        'Target Audience');

      // Policy
      add('Tax Incentives',         'Tax Incentives');
      add('Startup Programs',       'Startup Support Programs');
      add('Certifications',         'Minority Business Certifications');
      add('Gov Initiatives',        'Government-Backed Initiatives');

      // Cost
      add('Living Expenses',        'Living Expenses');
      add('Business Setup',         'Business Setup Costs');
      add('Hiring Costs',           'Hiring Costs');
      add('Utilities',              'Utilities & Infrastructure');

      return lines.join('\n');
    })
    .join('\n\n');
}

function buildCompactSummary(profiles: CityProfile[]): string {
  const header =
    `City | State | Cost Index | Housing Index | Opportunity Score | Network Strength | Business Score | Grant | Grant Amount`;
  const rows = profiles.map((p) =>
    [
      p['City']                        || '',
      p['State']                       || '',
      p['Cost Index (0-100)']          || '',
      p['Housing Index Score (0-100)'] || '',
      p['Opportunity Score (0-100)']   || '',
      p['Network Strength (0-100)']    || '',
      p['Business Score (0-100)']      || '',
      p['Grant Name']                  || '',
      p['Funding Amount']              || '',
    ].join(' | ')
  );

  // Also append full profiles for top 5 by Opportunity Score
  const topFive = [...profiles]
    .sort((a, b) => {
      const aScore = parseInt(a['Opportunity Score (0-100)'] || '0');
      const bScore = parseInt(b['Opportunity Score (0-100)'] || '0');
      return bScore - aScore;
    })
    .slice(0, 5);

  return (
    `Summary table (${profiles.length} cities):\n${header}\n${rows.join('\n')}` +
    `\n\nTop 5 by Opportunity Score (full profiles):\n${buildContext(topFive)}`
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns a context string for injection into the AI system prompt.
 * @param question   The user's message — used for relevance matching.
 * @param maxProfiles Cap the number of profiles returned (default: unlimited).
 *                   Pass a small number (e.g. 3) for small/local models.
 */
export async function buildRagContext(question: string, maxProfiles?: number): Promise<string> {
  try {
    const profiles = await loadProfiles();
    if (profiles.length === 0) return '';

    let relevant = findRelevantProfiles(question, profiles);
    if (maxProfiles && relevant.length > maxProfiles) {
      // Keep the top-N by Opportunity Score
      relevant = [...relevant]
        .sort((a, b) => {
          const aScore = parseInt(a['Opportunity Score (0-100)'] || '0');
          const bScore = parseInt(b['Opportunity Score (0-100)'] || '0');
          return bScore - aScore;
        })
        .slice(0, maxProfiles);
    }

    return buildContext(relevant);
  } catch {
    return '';
  }
}

/** Force-refresh the in-memory cache (useful after the agent updates the sheet). */
export function invalidateRagCache(): void {
  _profileCache   = null;
  _cacheExpiresAt = 0;
}
