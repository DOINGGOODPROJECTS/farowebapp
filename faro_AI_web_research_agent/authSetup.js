/**
 * One-time script to obtain a Google OAuth refresh token.
 * Run: npm run google-auth
 * It starts a local server on port 5000, opens the auth URL in your terminal,
 * and saves the refresh token to .env.local automatically.
 */
import http from "http";
import { URL } from "url";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createOAuthClient, REDIRECT_URI } from "./googleAuth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.join(__dirname, ".env.local");

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
];

const oauth2Client = createOAuthClient();

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  scope: SCOPES,
  prompt: "consent",
});

console.log("\n=== Faro AI — Google Auth Setup ===\n");
console.log("Open this URL in your browser:\n");
console.log(authUrl);
console.log(`\nWaiting for callback on ${REDIRECT_URI} ...\n`);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost:5000");
  if (url.pathname !== "/api/auth/callback/google") {
    res.end("Not found");
    return;
  }

  const code = url.searchParams.get("code");
  if (!code) {
    res.writeHead(400);
    res.end("Missing code parameter.");
    return;
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    const refreshToken = tokens.refresh_token;

    if (!refreshToken) {
      res.writeHead(500);
      res.end("No refresh token returned. Revoke app access and try again.");
      server.close();
      process.exit(1);
    }

    let envContent = fs.existsSync(ENV_PATH)
      ? fs.readFileSync(ENV_PATH, "utf8")
      : "";

    if (/^GOOGLE_REFRESH_TOKEN=.*/m.test(envContent)) {
      envContent = envContent.replace(
        /^GOOGLE_REFRESH_TOKEN=.*/m,
        `GOOGLE_REFRESH_TOKEN=${refreshToken}`
      );
    } else {
      envContent = envContent.trimEnd() + `\nGOOGLE_REFRESH_TOKEN=${refreshToken}\n`;
    }

    fs.writeFileSync(ENV_PATH, envContent);
    console.log("Refresh token saved to .env.local\n");
    console.log("You can now run the agent: npm run agent -- <url>\n");

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(
      "<h2 style='font-family:sans-serif;color:green'>Auth successful! Refresh token saved to .env.local.<br>You can close this tab.</h2>"
    );
    server.close();
    process.exit(0);
  } catch (err) {
    res.writeHead(500);
    res.end(`Error: ${err.message}`);
    server.close();
    process.exit(1);
  }
});

server.listen(5000);
