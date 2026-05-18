import { google } from "googleapis";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env.local") });

export const REDIRECT_URI = "http://localhost:5000/api/auth/callback/google";

export function createOAuthClient() {
  return new google.auth.OAuth2(
    process.env.google_oauth,
    process.env.google_secret,
    REDIRECT_URI
  );
}

/**
 * Returns an authenticated Google API client.
 *
 * Priority:
 *   1. Service Account JSON file  (GOOGLE_SERVICE_ACCOUNT_KEY_FILE)
 *   2. Service Account JSON inline (GOOGLE_SERVICE_ACCOUNT_KEY)
 *   3. OAuth2 refresh token        (GOOGLE_REFRESH_TOKEN)  ← manual, expires in testing mode
 */
export function getAuthClient() {
  const SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
  ];

  // ── 1. Service account key file path ─────────────────────────────────────
  const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;
  if (keyFile) {
    const resolvedPath = path.isAbsolute(keyFile)
      ? keyFile
      : path.join(__dirname, keyFile);
    if (fs.existsSync(resolvedPath)) {
      return new google.auth.GoogleAuth({ keyFile: resolvedPath, scopes: SCOPES });
    }
    console.warn(`[googleAuth] Key file not found at ${resolvedPath} — trying inline key`);
  }

  // ── 2. Service account key JSON inline (stored as env var) ───────────────
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (keyJson) {
    try {
      const credentials = JSON.parse(keyJson);
      return new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
    } catch {
      console.warn("[googleAuth] GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON — falling back to OAuth");
    }
  }

  // ── 3. OAuth2 refresh token (legacy / manual) ─────────────────────────────
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error(
      "No Google auth configured. Set GOOGLE_SERVICE_ACCOUNT_KEY_FILE or GOOGLE_SERVICE_ACCOUNT_KEY in .env.local.\n" +
      "See: https://console.cloud.google.com/iam-admin/serviceaccounts"
    );
  }
  const client = createOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}
