import { NextResponse } from "next/server";
import { resolveBackendUrl } from "@/lib/backendUrl";

export const runtime = "nodejs";
export const maxDuration = 210;

type GuestChatPayload = {
  message?: string;
  guestId?: string;
};

const getInstantReply = (message: string): string | null => {
  const normalized = message.toLowerCase().replace(/[^\w\s]/g, "").trim();
  const compact = normalized.replace(/\s+/g, " ");

  if (["hi", "hello", "hey", "yo", "good morning", "good afternoon", "good evening"].includes(compact)) {
    return "Hi. Tell me your city, industry, budget, or grant question and I will help you compare options.";
  }

  if (["thanks", "thank you", "thx"].includes(compact)) {
    return "You are welcome.";
  }

  const budgetMatch = compact.match(/\b(?:budget|budget is|with)\s*(?:is\s*)?\$?(\d[\d,]*)\b/);
  const industryMatch = compact.match(/\bindustry\s*(?:is|:)?\s*([a-z][a-z\s-]{1,40})/);
  const locationMatch = compact.match(/\b(?:city|state|location)\s*(?:is|:)?\s*([a-z][a-z\s-]{1,40}?)(?:\s+budget|\s+industry|$)/);

  if (budgetMatch || industryMatch || locationMatch) {
    const budget = budgetMatch?.[1] ? `$${budgetMatch[1]}` : "your current budget";
    const industry = industryMatch?.[1]?.trim() || "your industry";
    const location = locationMatch?.[1]?.trim() || "that market";
    const isAlabama = /\balabama\b/.test(location);
    const placeNote = isAlabama
      ? "Alabama is a state, so I would compare Birmingham, Huntsville, Montgomery, and Mobile before choosing one city."
      : `For ${location}, I would first verify startup costs, local founder programs, and whether the city has customers or partners for ${industry}.`;

    return [
      placeNote,
      `With a ${budget} budget in ${industry}, keep the first move lean: validate demand, avoid long leases, and prioritize free support from an SBDC, chamber of commerce, or tech incubator.`,
      "Next steps: pick 2 candidate cities, list monthly costs for each, then look for local small-business grants or incubator programs before spending on setup.",
    ].join("\n\n");
  }

  return null;
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

    const instantReply = getInstantReply(message);
    if (instantReply) {
      return NextResponse.json({
        reply: instantReply,
      });
    }

    const backendUrl = await resolveBackendUrl();
    if (!backendUrl) {
      return NextResponse.json(
        {
          error: "Unable to reach the Faro backend.",
          details: "Backend URL is not configured.",
        },
        { status: 500 },
      );
    }

    try {
      const upstream = await fetch(`${backendUrl}/api/chat/guest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getForwardedIpHeaders(request),
        },
        body: JSON.stringify({ message, guestId: body.guestId }),
        signal: AbortSignal.timeout(195000),
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
