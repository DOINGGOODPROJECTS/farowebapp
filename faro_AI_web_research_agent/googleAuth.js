import { google } from "googleapis";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

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

export function getAuthClient() {
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error(
      "No GOOGLE_REFRESH_TOKEN found in .env.local. Run: npm run google-auth"
    );
  }
  const client = createOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}
