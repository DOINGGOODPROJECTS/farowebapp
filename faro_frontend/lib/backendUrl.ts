import { readFile } from "node:fs/promises";
import path from "node:path";

let cachedBackendUrl: string | null = null;
let cachedBackendUrlLoaded = false;

const parseEnvFile = (content: string) => {
  const result: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) result[key] = value;
  }
  return result;
};

const loadBackendUrlFromFiles = async (): Promise<string | null> => {
  const candidates = [
    path.join(process.cwd(), ".env.local"),
    path.join(process.cwd(), ".env"),
    path.join(process.cwd(), "..", ".env"),
    path.join(process.cwd(), "..", "faro_backend", ".env"),
  ];

  for (const filePath of candidates) {
    try {
      const content = await readFile(filePath, "utf8");
      const env = parseEnvFile(content);
      const url =
        env.FARO_BACKEND_URL || env.BACKEND_URL || env.NEXT_PUBLIC_BACKEND_URL;
      if (url) return url;
    } catch {
      // ignore missing/unreadable files
    }
  }

  return null;
};

export const resolveBackendUrl = async (): Promise<string | null> => {
  const direct =
    process.env.FARO_BACKEND_URL ||
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL;
  if (direct) return direct;

  if (cachedBackendUrlLoaded) return cachedBackendUrl;
  cachedBackendUrlLoaded = true;
  cachedBackendUrl = await loadBackendUrlFromFiles();
  return cachedBackendUrl;
};

