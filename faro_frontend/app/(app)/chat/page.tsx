"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthUser } from "../auth-gate";
// Use browser's built-in SpeechRecognition types only

type UiMessage = {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
  meta?: string | null;
};

type ChatSession = {
  id: number;
  title: string | null;
  updatedAt: string;
  lastMessage?: {
    content: string;
    createdAt: string;
  } | null;
};

type DbMessage = {
  id: number;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  createdAt: string;
};

type ParsedTable = {
  header: string[];
  rows: string[][];
  before: string;
  after: string;
} | null;

const parseMarkdownTable = (text: string): ParsedTable => {
  const lines = text.split("\n");
  const headerIndex = lines.findIndex((line) => /\|/.test(line));
  if (headerIndex === -1) return null;
  const dividerIndex = lines.findIndex(
    (line, index) =>
      index > headerIndex &&
      /^(\s*\|?\s*:?-+:?\s*)+\|?\s*$/.test(line)
  );
  if (dividerIndex === -1) return null;
  const headerLine = lines[headerIndex];
  const header = headerLine
    .split("|")
    .map((cell) => cell.trim())
    .filter(Boolean);
  if (header.length === 0) return null;

  const rows: string[][] = [];
  let rowIndex = dividerIndex + 1;
  for (; rowIndex < lines.length; rowIndex += 1) {
    const line = lines[rowIndex];
    if (!/\|/.test(line)) break;
    const cells = line
      .split("|")
      .map((cell) => cell.trim())
      .filter(Boolean);
    if (cells.length > 0) {
      rows.push(cells);
    }
  }

  if (rows.length === 0) return null;

  const before = lines.slice(0, headerIndex).join("\n").trim();
  const after = lines.slice(rowIndex).join("\n").trim();

  return { header, rows, before, after };
};

const renderMessageText = (text: string) =>
  text.split("\n").map((line, index) => (
    <p key={`${index}-${line}`} className="text-lg leading-relaxed">
      {line || "\u00a0"}
    </p>
  ));

const renderAssistantContent = (text: string) => {
  const table = parseMarkdownTable(text);
  if (!table) {
    return renderMessageText(text);
  }

  return (
    <div className="space-y-4">
      {table.before ? (
        <div className="space-y-1">{renderMessageText(table.before)}</div>
      ) : null}
      <div className="overflow-x-auto rounded-2xl border border-black/10 bg-white/90">
        <table className="w-full text-left text-base text-[#1e1a16]">
          <thead className="bg-[#f5f1ea] text-xs uppercase tracking-[0.2em] text-[#7a6f63]">
            <tr>
              {table.header.map((cell) => (
                <th key={cell} className="px-4 py-3 font-semibold">
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, rowIndex) => (
              <tr
                key={`${rowIndex}-${row.join("-")}`}
                className="border-t border-black/5"
              >
                {row.map((cell, cellIndex) => (
                  <td key={`${rowIndex}-${cellIndex}`} className="px-4 py-3">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.after ? (
        <div className="space-y-1">{renderMessageText(table.after)}</div>
      ) : null}
    </div>
  );
};

const formatUsageMeta = (usage: unknown): string | null => {
  if (!usage) return null;

  const asRecord = (value: unknown): Record<string, unknown> | null =>
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;

  const parseJsonRecord = (value: string): Record<string, unknown> | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      return asRecord(JSON.parse(trimmed));
    } catch {
      return null;
    }
  };

  const usageRecord =
    asRecord(asRecord(usage)?.usage) ??
    asRecord(usage) ??
    (typeof usage === "string" ? parseJsonRecord(usage) : null);
  if (!usageRecord) return null;

  const centicredits =
    typeof usageRecord.centicredits === "number" ? usageRecord.centicredits : null;
  const credits =
    typeof usageRecord.credits === "number"
      ? usageRecord.credits
      : typeof usageRecord.creditsUsed === "number"
        ? usageRecord.creditsUsed
        : null;
  const operations =
    typeof usageRecord.operations === "number" ? usageRecord.operations : null;
  const transfer =
    typeof usageRecord.transfer === "number" ? usageRecord.transfer : null;

  const promptTokens =
    typeof usageRecord.prompt_tokens === "number"
      ? usageRecord.prompt_tokens
      : typeof usageRecord.promptTokens === "number"
        ? usageRecord.promptTokens
        : null;
  const completionTokens =
    typeof usageRecord.completion_tokens === "number"
      ? usageRecord.completion_tokens
      : typeof usageRecord.completionTokens === "number"
        ? usageRecord.completionTokens
        : null;
  const totalTokens =
    typeof usageRecord.total_tokens === "number"
      ? usageRecord.total_tokens
      : typeof usageRecord.totalTokens === "number"
        ? usageRecord.totalTokens
        : null;

  const parts: string[] = [];
  if (centicredits !== null) {
    parts.push(`Credits used: ${(centicredits / 100).toFixed(2)}`);
  } else if (credits !== null) {
    parts.push(`Credits used: ${credits.toFixed(2)}`);
  }
  if (operations !== null) parts.push(`Ops: ${operations}`);
  if (transfer !== null) parts.push(`Transfer: ${transfer}B`);

  if (totalTokens !== null) {
    parts.push(`Tokens: ${totalTokens}`);
  } else if (promptTokens !== null || completionTokens !== null) {
    parts.push(`Tokens: ${promptTokens ?? 0} in / ${completionTokens ?? 0} out`);
  }

  if (parts.length > 0) return parts.join(" · ");
  try {
    return `Usage: ${JSON.stringify(usageRecord).slice(0, 160)}`;
  } catch {
    return null;
  }
};

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthUser();
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";
  const guestLimitMessage =
    "You’ve used your 2 free questions. Log in or create an account to keep going.";
  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [isStartingNewChat, setIsStartingNewChat] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [guestLimitReached, setGuestLimitReached] = useState(false);
  const [imagePasteError, setImagePasteError] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoQuestionHandled = useRef(false);

  useEffect(() => {
    if (user) {
      setGuestLimitReached(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setCreditsRemaining(null);
      return;
    }

    setCreditsRemaining(
      typeof user.chatCredits === "number" && Number.isFinite(user.chatCredits)
        ? user.chatCredits
        : null,
    );
  }, [user]);

  const parseResponsePayload = async (response: Response) => {
    const raw = await response.text();
    const trimmed = raw.trim();
    const contentType = response.headers.get("content-type") || "";
    const looksLikeHtml =
      contentType.includes("text/html") ||
      trimmed.startsWith("<!DOCTYPE") ||
      trimmed.startsWith("<html");
    if (!trimmed) {
      return {
        raw: "",
        data: null as Record<string, unknown> | null,
        looksLikeHtml,
      };
    }
    try {
      return {
        raw,
        data: JSON.parse(trimmed) as Record<string, unknown>,
        looksLikeHtml,
      };
    } catch {
      return { raw, data: null as Record<string, unknown> | null, looksLikeHtml };
    }
  };

  useEffect(() => {
    const SpeechRecognitionCtor =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      return;
    }
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript)
        .join(" ");
      setInput(transcript.trim());
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
  }, []);

  useEffect(() => {
    if (!user) {
      setSessions([]);
      setActiveSessionId(null);
      return;
    }
    let active = true;
    const loadSessions = async () => {
      try {
        const response = await fetch(`${backendUrl}/api/chat/sessions`, {
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error("Unable to load sessions");
        }
        const payload = (await response.json()) as ChatSession[];
        const normalized = payload
          .map((session) => ({
            ...session,
            id: Number(session.id),
          }))
          .filter((session) => Number.isFinite(session.id));
        if (!active) return;
        setSessions(normalized);
        if (
          normalized.length > 0 &&
          !isStartingNewChat &&
          (!activeSessionId ||
            !normalized.some((item) => item.id === activeSessionId))
        ) {
          setActiveSessionId(normalized[0].id);
        }
      } catch {
        if (active) {
          setSessions([]);
        }
      }
    };
    loadSessions();
    return () => {
      active = false;
    };
  }, [backendUrl, activeSessionId, isStartingNewChat, user]);

  const loadMessagesForSession = async (sessionId: number) => {
    setIsLoadingMessages(true);
    try {
      const response = await fetch(
        `${backendUrl}/api/chat/sessions/${sessionId}/messages`,
        { credentials: "include" }
      );
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Unable to load messages");
      }
      const payload = (await response.json()) as DbMessage[];
      // Only include messages with role USER or ASSISTANT
      const nextMessages: UiMessage[] = payload
        .filter((item) => item.role === "USER" || item.role === "ASSISTANT")
        .map((item) => ({
          id: String(item.id),
          sender: item.role === "USER" ? "user" as const : "assistant" as const,
          text: item.content,
          timestamp: new Date(item.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        }));
      setMessages(nextMessages);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  useEffect(() => {
    let active = true;
    const loadMessages = async () => {
      if (!user) {
        return;
      }
      if (!activeSessionId) {
        if (sessions.length === 0) {
          setMessages([]);
        }
        return;
      }
      try {
        await loadMessagesForSession(activeSessionId);
      } catch {
        if (active) {
          setMessages((prev) => prev);
        }
      }
    };
    loadMessages();
    return () => {
      active = false;
    };
  }, [backendUrl, activeSessionId, sessions.length, user]);

  const refreshSessions = async () => {
    if (!user) return;
    const response = await fetch(`${backendUrl}/api/chat/sessions`, {
      credentials: "include",
    });
    if (!response.ok) return;
    const payload = (await response.json()) as ChatSession[];
    const normalized = payload
      .map((session) => ({
        ...session,
        id: Number(session.id),
      }))
      .filter((session) => Number.isFinite(session.id));
    setSessions(normalized);
    if (
      normalized.length > 0 &&
      !isStartingNewChat &&
      (!activeSessionId ||
        !normalized.some((item) => item.id === activeSessionId))
    ) {
      setActiveSessionId(normalized[0].id);
    }
  };

  const handleDeleteSession = async (sessionId: number) => {
    if (!user) return;
    const response = await fetch(`${backendUrl}/api/chat/sessions/${sessionId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!response.ok) return;
    if (sessionId === activeSessionId) {
      setActiveSessionId(null);
      setMessages([]);
    }
    await refreshSessions();
  };

  const handleSelectSession = async (sessionId: number) => {
    if (!Number.isFinite(sessionId)) {
      const assistantMessage: UiMessage = {
        id: crypto.randomUUID(),
        sender: "assistant",
        text: "Unable to load this conversation. Invalid session id.",
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setMessages([assistantMessage]);
      return;
    }
    setIsStartingNewChat(false);
    setActiveSessionId(sessionId);
    try {
      await loadMessagesForSession(sessionId);
    } catch (error) {
      const assistantMessage: UiMessage = {
        id: crypto.randomUUID(),
        sender: "assistant",
        text:
          error instanceof Error
            ? `Unable to load this conversation. ${error.message}`
            : "Unable to load this conversation.",
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setMessages([assistantMessage]);
    }
  };

	  const sendMessage = async (messageText: string) => {
	    const trimmed = messageText.trim();
	    if (!trimmed) return;
	    if (isSending) return;
	    if (user && creditsRemaining !== null && creditsRemaining <= 0) {
	      const assistantMessage: UiMessage = {
	        id: crypto.randomUUID(),
	        sender: "assistant",
	        text: "You’ve used all your chat credits. Please upgrade to continue chatting.",
	        timestamp: new Date().toLocaleTimeString([], {
	          hour: "2-digit",
	          minute: "2-digit",
	        }),
	      };
	      setMessages((prev) => [...prev, assistantMessage]);
	      return;
	    }
	    if (!user && guestLimitReached) {
	      const assistantMessage: UiMessage = {
	        id: crypto.randomUUID(),
	        sender: "assistant",
        text: guestLimitMessage,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      return;
    }
    const userMessage: UiMessage = {
      id: crypto.randomUUID(),
      sender: "user",
      text: trimmed,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsSending(true);

    try {
      if (!user) {
        const response = await fetch(`/api/chat/guest`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ message: userMessage.text }),
        });
        const { raw, data, looksLikeHtml } = await parseResponsePayload(response);
        const payload = data;
        if (looksLikeHtml) {
          throw new Error(
            "Guest chat returned HTML instead of JSON. This usually means the frontend is deployed as a static site (no Next.js API routes). Deploy the frontend with a Node/Next runtime, or route guest chat through a running backend.",
          );
        }
        if (!response.ok) {
          if (response.status === 429) {
            setGuestLimitReached(true);
            const assistantMessage: UiMessage = {
              id: crypto.randomUUID(),
              sender: "assistant",
              text:
                (payload?.error as string | undefined) ||
                guestLimitMessage,
              timestamp: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
            };
            setMessages((prev) => [...prev, assistantMessage]);
            setIsSending(false);
            return;
          }
          const errorMessage =
            (payload?.error as string | undefined) ||
            (raw ? String(raw).slice(0, 200) : undefined) ||
            "Unable to get AI response.";
          throw new Error(errorMessage);
        }
        const assistantText =
          payload?.reply ||
          payload?.response ||
          payload?.text ||
          raw ||
          "Thanks for the context. How can I help next?";
        const meta = formatUsageMeta(
          payload?.usage ??
            (typeof payload?.creditsUsed === "number"
              ? { creditsUsed: payload.creditsUsed }
              : null),
        );
        const assistantMessage: UiMessage = {
          id: crypto.randomUUID(),
          sender: "assistant",
          text: String(assistantText),
          meta,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setIsSending(false);
        return;
      }

      const response = await fetch(`${backendUrl}/api/chat/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message: userMessage.text,
          sessionId: activeSessionId ?? undefined,
        }),
	      });
	      const payload = await response.json();
	      const nextCredits =
	        typeof payload?.creditsRemaining === "number"
	          ? payload.creditsRemaining
	          : typeof payload?.creditsRemaining === "string"
	            ? Number(payload.creditsRemaining)
	            : null;
	      if (nextCredits !== null && Number.isFinite(nextCredits)) {
	        setCreditsRemaining(nextCredits);
	      }
	      if (!response.ok) {
	        throw new Error(payload?.error || payload?.details || "Unable to get AI response.");
	      }
      const assistantText =
        payload?.reply ||
        payload?.response ||
        payload?.text ||
        "Thanks for the context. How can I help next?";
      const meta = formatUsageMeta(
        payload?.usage ??
          (typeof payload?.creditsUsed === "number"
            ? { creditsUsed: payload.creditsUsed }
            : null),
      );
      const assistantMessage: UiMessage = {
        id: crypto.randomUUID(),
        sender: "assistant",
        text: String(assistantText),
        meta,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      if (payload?.sessionId && payload.sessionId !== activeSessionId) {
        setActiveSessionId(payload.sessionId);
      }
      setIsStartingNewChat(false);
      setMessages((prev) => [...prev, assistantMessage]);
      await refreshSessions();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unable to reach the AI agent.";
      const displayMessage =
        /NetworkError|Failed to fetch/i.test(errorMessage)
          ? user
            ? `Unable to reach the chat backend (${backendUrl}). Check NEXT_PUBLIC_BACKEND_URL and that the backend is running (try ${backendUrl}/api/health).`
            : "Unable to reach the guest chat service. If this is self-hosted, ensure the frontend is deployed with MAKE_WEBHOOK_URL (and optional MAKE_WEBHOOK_API_KEY)."
          : errorMessage;
      const assistantMessage: UiMessage = {
        id: crypto.randomUUID(),
        sender: "assistant",
        text: displayMessage,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } finally {
      setIsSending(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const next = input;
    setInput("");
    await sendMessage(next);
  };

  useEffect(() => {
    const question = searchParams.get("question");
    if (!question || autoQuestionHandled.current) return;
    autoQuestionHandled.current = true;
    sendMessage(question);
    router.replace("/");
  }, [router, searchParams]);

  const groupedMessages = useMemo(() => messages, [messages]);

  const startListening = () => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    setListening(true);
    recognition.start();
  };

  const creditBlocked = Boolean(
    user && creditsRemaining !== null && creditsRemaining <= 0,
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1.6fr_0.8fr]">
      <section className="glass-panel flex h-[85vh] flex-col rounded-3xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-[#c59a4a]">
              AI Conversation
            </p>
            <h2 className="mt-2 font-serif text-2xl text-[#1e1a16]">
              Ask about cities, grants, and relocation fit.
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <div className="rounded-full border border-[#1e1a16]/20 bg-white/70 px-4 py-2 text-xs font-semibold text-[#1e1a16]">
                Credits:{" "}
                <strong>
                  {creditsRemaining !== null
                    ? creditsRemaining.toFixed(2)
                    : "—"}
                </strong>
              </div>
            ) : null}
            <button
              onClick={startListening}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                listening
                  ? "bg-[#0f766e] text-white"
                  : "border border-[#1e1a16]/20 bg-white/70 text-[#1e1a16]"
              }`}
              disabled={listening}
            >
              {listening ? "Listening..." : "Voice input"}
            </button>
          </div>
        </div>
        <div className="mt-6 flex-1 space-y-4 overflow-y-auto pr-2 text-xl">
          {groupedMessages.length === 0 && (
            <p className="rounded-2xl border border-dashed border-[#1e1a16]/15 bg-white/60 p-4 text-sm text-[#6a6056]">
              Start by asking about a city, &quot;Compare Atlanta and Houston&quot;,
              or &quot;Find grants for fintech&quot;.
            </p>
          )}
          {isLoadingMessages && (
            <p className="rounded-2xl border border-black/5 bg-white/80 p-4 text-sm text-[#6a6056]">
              Loading conversation...
            </p>
          )}
          {groupedMessages.map((message) => (
            <div
              key={message.id}
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-xl shadow-sm ${
                message.sender === "user"
                  ? "ml-auto bg-[#1e1a16] text-white"
                  : "bg-white/80 text-[#1e1a16]"
              }`}
            >
              {message.sender === "assistant"
                ? renderAssistantContent(message.text)
                : renderMessageText(message.text)}
              {message.sender === "assistant" && message.meta ? (
                <p className="mt-2 text-xs opacity-70">{message.meta}</p>
              ) : null}
              <p className="mt-2 text-xs opacity-70">{message.timestamp}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              setImagePasteError(false);
            }}
	            onPaste={(event) => {
	              const clipboardData = event.clipboardData;
	              if (clipboardData && clipboardData.types.some((type) => type.startsWith('image/'))) {
	                event.preventDefault();
	                setImagePasteError(true);
	                setTimeout(() => setImagePasteError(false), 3000);
	              }
	            }}
	            placeholder={
	              creditBlocked
	                ? "Upgrade to continue chatting"
	                : !user && guestLimitReached
	                  ? "Log in or sign up to continue the conversation"
	                  : "Ask Faro"
	            }
	            disabled={creditBlocked || (!user && guestLimitReached)}
	            className="min-w-[240px] flex-1 rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-lg text-[#1e1a16] outline-none focus:border-[#0f766e] disabled:cursor-not-allowed disabled:opacity-60"
	          />
          {imagePasteError && (
            <p className="mt-2 w-full text-sm text-red-600">
              Image paste is not supported. Faro currently only accepts text input.
            </p>
          )}
	          <button
	            onClick={handleSend}
	            disabled={isSending || creditBlocked || (!user && guestLimitReached)}
	            className="rounded-full bg-[#1e1a16] px-5 py-3 text-xs font-semibold text-white shadow-sm transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
	          >
	            {isSending ? "Sending..." : "Send"}
	          </button>
	        </div>
	        {creditBlocked && (
	          <div className="mt-3 flex flex-wrap items-center gap-3">
	            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#8a7d70]">
	              Credits exhausted.
	            </p>
	            <Link
	              href="/subscription"
	              className="rounded-full bg-[#0f766e] px-4 py-2 text-[11px] font-semibold text-white transition hover:bg-[#0b5e58]"
	            >
	              Upgrade to continue →
	            </Link>
	          </div>
	        )}
	        {!user && !guestLimitReached && (
	          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.3em] text-[#8a7d70]">
	            Guest mode: 2 free questions. Then log in or create an account to
	            keep chatting.
          </p>
        )}
        {!user && guestLimitReached && (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.3em] text-[#8a7d70]">
            <span>{guestLimitMessage}</span>
            <Link
              href="/login"
              className="rounded-full border border-[#1e1a16]/20 bg-white/70 px-4 py-2 text-[11px] text-[#1e1a16] transition hover:border-[#0f766e] hover:text-[#0f766e]"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-[#1e1a16] px-4 py-2 text-[11px] text-white transition hover:bg-black"
            >
              Create account
            </Link>
          </div>
        )}
      </section>

      <aside className="glass-panel rounded-3xl p-6">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.4em] text-[#c59a4a]">
            Chat history
          </p>
          <button
            onClick={() => {
              setIsStartingNewChat(true);
              setActiveSessionId(null);
              setMessages([]);
            }}
            className="rounded-full border border-[#1e1a16]/20 bg-white/70 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-[#1e1a16] transition hover:border-[#0f766e] hover:text-[#0f766e]"
          >
            New chat
          </button>
        </div>
        <div className="mt-4 space-y-3 text-sm text-[#5a5249]">
          {sessions.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[#1e1a16]/15 bg-white/60 p-4 text-sm text-[#6a6056]">
              No conversations yet. Start a new chat to save it here.
            </p>
          ) : (
            sessions.map((session) => {
              const sessionId = Number(session.id);
              return (
              <div
                key={session.id}
                role="button"
                tabIndex={0}
                onClick={() => handleSelectSession(sessionId)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleSelectSession(sessionId);
                  }
                }}
                className={`w-full cursor-pointer rounded-2xl border px-4 py-3 text-left transition ${
                  session.id === activeSessionId
                    ? "border-[#0f766e] bg-[#0f766e]/10 text-[#0b4f4a]"
                    : "border-black/5 bg-white/80 text-[#1e1a16]"
                }`}
              >
                <p className="text-sm font-semibold">
                  {session.title || "New chat"}
                </p>
                <p className="mt-2 text-xs text-[#6a6056]">
                  {session.lastMessage?.content
                    ? session.lastMessage.content.slice(0, 80)
                    : "No messages yet."}
                </p>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeleteSession(sessionId);
                    }}
                    className="rounded-full border border-red-200 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-red-600 transition hover:border-red-300 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
            })
          )}
        </div>
      </aside>
    </div>
  );
}
