import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type GuestChatPayload = {
  message?: string;
  guestId?: string;
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

    const backendUrl = process.env.FARO_BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "";

    try {
      const upstream = await fetch(`${backendUrl}/api/chat/guest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getForwardedIpHeaders(request),
        },
        body: JSON.stringify({ message, guestId: body.guestId }),
        signal: AbortSignal.timeout(55000),
      });

      const raw = await upstream.text();

      let parsed: unknown = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        // not JSON — return as-is
      }

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
          error: "Unable to reach the Faro backend.",
          details: String(error),
          backendUrl,
        },
        { status: 500 },
      );
    }
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
