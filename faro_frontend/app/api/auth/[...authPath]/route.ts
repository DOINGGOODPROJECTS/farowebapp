import { NextRequest, NextResponse } from "next/server";
import { resolveBackendUrl } from "@/lib/backendUrl";

export const runtime = "nodejs";

type Params = {
  authPath: string[];
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

const proxyAuth = async (
  request: NextRequest,
  authPath: string[],
): Promise<NextResponse> => {
  const resolvedBackendUrl = await resolveBackendUrl();
  if (!resolvedBackendUrl) {
    return NextResponse.json(
      {
        error:
          "Auth backend is not configured. Set FARO_BACKEND_URL (recommended) or NEXT_PUBLIC_BACKEND_URL on the frontend.",
      },
      { status: 500 },
    );
  }

  const incomingUrl = new URL(request.url);
  const backendUrl = resolvedBackendUrl.trim();
  const backendWithScheme = /^https?:\/\//i.test(backendUrl)
    ? backendUrl
    : /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(backendUrl)
      ? `http://${backendUrl}`
      : `https://${backendUrl.replace(/^\/+/, "")}`;

  let upstreamUrl: URL;
  try {
    upstreamUrl = new URL(
      `${backendWithScheme.replace(/\/+$/, "")}/api/auth/${authPath.join("/")}`,
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          "Invalid auth backend URL. Set FARO_BACKEND_URL (recommended) or NEXT_PUBLIC_BACKEND_URL to a full URL like https://example.com.",
        details: String(error),
        backendUrl: resolvedBackendUrl,
      },
      { status: 500 },
    );
  }
  upstreamUrl.search = incomingUrl.search;

  const contentType = request.headers.get("content-type") || "";
  const cookie = request.headers.get("cookie");
  const authorization = request.headers.get("authorization");

  const method = request.method.toUpperCase();
  const body =
    method === "GET" || method === "HEAD" ? undefined : await request.text();

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method,
      headers: {
        ...(contentType ? { "Content-Type": contentType } : {}),
        ...(cookie ? { cookie } : {}),
        ...(authorization ? { authorization } : {}),
        ...getForwardedIpHeaders(request),
      },
      body,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to reach auth backend.",
        details: String(error),
        backendUrl,
      },
      { status: 502 },
    );
  }

  const raw = await upstream.text();

  if (!raw && !upstream.ok) {
    return NextResponse.json(
      {
        error: "Auth backend returned an empty response.",
        status: upstream.status,
      },
      { status: upstream.status },
    );
  }

  const proxyResponse = new NextResponse(raw, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "application/json",
    },
  });

  const setCookies = upstream.headers.getSetCookie?.() ?? [];
  for (const cookieValue of setCookies) {
    proxyResponse.headers.append("set-cookie", cookieValue);
  }

  return proxyResponse;
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<Params> },
) {
  const { authPath } = await context.params;
  return proxyAuth(request, authPath);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<Params> },
) {
  const { authPath } = await context.params;
  return proxyAuth(request, authPath);
}
