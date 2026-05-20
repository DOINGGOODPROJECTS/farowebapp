import { NextRequest, NextResponse } from "next/server";
import { resolveBackendUrl } from "@/lib/backendUrl";

export const runtime = "nodejs";

type Params = {
  chatPath: string[];
};

const proxyChatRequest = async (
  request: NextRequest,
  chatPath: string[],
): Promise<NextResponse> => {
  const backendUrl = await resolveBackendUrl();
  if (!backendUrl) {
    return NextResponse.json(
      { error: "Chat backend is not configured. Set FARO_BACKEND_URL or BACKEND_URL." },
      { status: 500 },
    );
  }

  const incomingUrl = new URL(request.url);
  const upstreamUrl = new URL(
    `${backendUrl.replace(/\/+$/, "")}/api/chat/${chatPath.join("/")}`,
  );
  upstreamUrl.search = incomingUrl.search;

  const cookie = request.headers.get("cookie");
  const authorization = request.headers.get("authorization");
  const contentType = request.headers.get("content-type") || "";

  const method = request.method.toUpperCase();
  const body = method === "GET" || method === "HEAD" ? undefined : await request.text();

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl.toString(), {
      method,
      headers: {
        ...(contentType ? { "Content-Type": contentType } : {}),
        ...(cookie ? { cookie } : {}),
        ...(authorization ? { authorization } : {}),
      },
      body,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to reach chat backend.", details: String(error) },
      { status: 502 },
    );
  }

  const raw = await upstream.text();
  return new NextResponse(raw, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "application/json",
    },
  });
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<Params> },
) {
  const { chatPath } = await context.params;
  return proxyChatRequest(request, chatPath);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<Params> },
) {
  const { chatPath } = await context.params;
  return proxyChatRequest(request, chatPath);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<Params> },
) {
  const { chatPath } = await context.params;
  return proxyChatRequest(request, chatPath);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<Params> },
) {
  const { chatPath } = await context.params;
  return proxyChatRequest(request, chatPath);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<Params> },
) {
  const { chatPath } = await context.params;
  return proxyChatRequest(request, chatPath);
}
