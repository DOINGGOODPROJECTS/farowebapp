import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

type GuestChatPayload = {
  message?: string;
  guestId?: string;
};

type WebhookResponse =
  | {
      reply?: string;
      response?: string;
      text?: string;
      error?: string;
      usage?: unknown;
      creditsUsed?: number;
      json?: string;
    }
  | null;

const escapeNewlinesInQuotedStrings = (input: string) => {
  let out = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i]!;

    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      out += ch;
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      out += ch;
      continue;
    }

    if (inString && ch === "\n") {
      out += "\\n";
      continue;
    }

    if (inString && ch === "\r") {
      out += "\\r";
      continue;
    }

    out += ch;
  }

  return out;
};

const normalizeWebhookResponse = (value: WebhookResponse): WebhookResponse => {
  if (!value) return value;
  if (typeof value.json !== "string") return value;

  const nestedRaw = value.json.trim();
  if (!nestedRaw) return value;
  try {
    return JSON.parse(nestedRaw) as WebhookResponse;
  } catch {
    try {
      return JSON.parse(
        escapeNewlinesInQuotedStrings(nestedRaw),
      ) as WebhookResponse;
    } catch {
      return value;
    }
  }
};

const parseWebhookResponse = (raw: string): WebhookResponse => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return normalizeWebhookResponse(JSON.parse(trimmed) as WebhookResponse);
  } catch {
    try {
      return normalizeWebhookResponse(
        JSON.parse(escapeNewlinesInQuotedStrings(trimmed)) as WebhookResponse,
      );
    } catch {
      // continue
    }
    if (trimmed.startsWith("{") && trimmed.includes('\\"')) {
      try {
        const normalized = escapeNewlinesInQuotedStrings(
          trimmed.replace(/\\"/g, '"'),
        );
        return normalizeWebhookResponse(JSON.parse(normalized) as WebhookResponse);
      } catch {
        return null;
      }
    }
    return null;
  }
};

type MakeWebhookConfig = {
  url: string;
  apiKey?: string;
};

let cachedMakeWebhookConfig: MakeWebhookConfig | null = null;
let cachedMakeWebhookConfigLoaded = false;

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

const loadMakeWebhookConfigFromFiles = async (): Promise<MakeWebhookConfig | null> => {
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
      const url = env.MAKE_WEBHOOK_URL;
      if (url) {
        return { url, apiKey: env.MAKE_WEBHOOK_API_KEY };
      }
    } catch {
      // ignore missing/unreadable files
    }
  }
  return null;
};

const resolveMakeWebhookConfig = async (): Promise<MakeWebhookConfig | null> => {
  if (process.env.MAKE_WEBHOOK_URL) {
    return {
      url: process.env.MAKE_WEBHOOK_URL,
      apiKey: process.env.MAKE_WEBHOOK_API_KEY,
    };
  }

  if (cachedMakeWebhookConfigLoaded) return cachedMakeWebhookConfig;
  cachedMakeWebhookConfigLoaded = true;
  cachedMakeWebhookConfig = await loadMakeWebhookConfigFromFiles();
  return cachedMakeWebhookConfig;
};

const getForwardedIpHeaders = (request: Request) => {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const cfIp = request.headers.get("cf-connecting-ip");

  return {
    ...(forwardedFor ? { "x-forwarded-for": forwardedFor } : {}),
    ...(realIp ? { "x-real-ip": realIp } : {}),
    ...(cfIp ? { "cf-connecting-ip": cfIp } : {}),
  };
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GuestChatPayload;
    const message = body.message?.trim();
    if (!message) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    const makeConfig = await resolveMakeWebhookConfig();
    const webhookUrl = makeConfig?.url;
    const threadId = body.guestId?.trim()
      ? `guest-${body.guestId.trim()}`
      : "guest-anon";

    if (!webhookUrl) {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "";

      try {
        const upstream = await fetch(`${backendUrl}/api/chat/guest`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getForwardedIpHeaders(request),
          },
          body: JSON.stringify({ message, guestId: body.guestId }),
        });

        const raw = await upstream.text();
        const parsed = parseWebhookResponse(raw);
        if (parsed) {
          return NextResponse.json(parsed, { status: upstream.status });
        }

        return new NextResponse(raw, {
          status: upstream.status,
          headers: {
            "Content-Type": upstream.headers.get("content-type") || "text/plain",
          },
        });
      } catch (error) {
        return NextResponse.json(
          {
            error:
              "Guest chat is not configured on the frontend (missing MAKE_WEBHOOK_URL) and the backend could not be reached.",
            details: String(error),
            backendUrl,
          },
          { status: 500 },
        );
      }
    }

    const webhookResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(makeConfig?.apiKey
          ? { "x-make-apikey": makeConfig.apiKey }
          : {}),
      },
      body: JSON.stringify({
        message,
        threadId,
        user: {
          id: threadId,
          email: "",
          name: "Guest",
        },
      }),
    });

    const raw = await webhookResponse.text();
    const parsed = parseWebhookResponse(raw);

    if (!webhookResponse.ok) {
      return NextResponse.json(
        { error: parsed?.error || "Unable to get AI response." },
        { status: webhookResponse.status },
      );
    }

    const assistantText =
      parsed?.reply ||
      parsed?.response ||
      parsed?.text ||
      raw ||
      "Thanks for the context. How can I help next?";
    const usage = parsed?.usage ?? null;
    const creditsUsed = typeof parsed?.creditsUsed === "number" ? parsed.creditsUsed : null;

    return NextResponse.json({
      reply: assistantText,
      ...(usage !== null && { usage }),
      ...(creditsUsed !== null && { creditsUsed }),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to send guest chat message",
        details: String(error),
      },
      { status: 500 },
    );
  }
}
