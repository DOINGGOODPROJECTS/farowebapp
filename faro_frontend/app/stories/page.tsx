"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Story = {
  id: number;
  title: string;
  city: string;
  summary: string;
  outcomes: string[];
  body: string;
  imageUrl: string | null;
  authorName?: string | null;
  createdAt: string;
};

const emptyForm = {
  prompt: "",
  title: "",
  city: "",
  summary: "",
  outcomes: "",
  body: "",
  imageUrl: "",
};

const buildPostMessage = (story: Story) => {
  const base = `${story.title} — ${story.summary} (${story.city})`;
  return base.length > 260 ? `${base.slice(0, 257)}...` : base;
};

const sampleStories: Story[] = [
  {
    id: 1,
    title: "Fintech relocation to Atlanta for faster enterprise pilots",
    city: "Atlanta, GA",
    summary:
      "Faro highlighted Atlanta’s network density and cost balance, helping a fintech founder secure two bank pilot intros within 45 days.",
    outcomes: ["2 pilot intros", "3 grant applications", "Mentor pipeline built"],
    body:
      "Faro compared Atlanta vs. Charlotte and prioritized Atlanta for network strength and enterprise access. The founder followed a 90‑day plan: week 1–2 ecosystem mapping, week 3–6 grant submissions, week 7–12 pilot meetings. By month two, two pilot pathways were opened and the founder secured local mentor support to accelerate procurement readiness.",
    imageUrl: "/fintech-atlanta.png",
    authorName: "Faro community",
    createdAt: new Date().toISOString(),
  },
  {
    id: 2,
    title: "Logistics operator chooses Houston for cost control",
    city: "Houston, TX",
    summary:
      "Faro surfaced Houston’s lower cost index and freight advantages, enabling a founder to cut operating costs while expanding regional coverage.",
    outcomes: ["15% cost reduction", "Warehouse shortlist", "2 supplier leads"],
    body:
      "With a $75k runway, Faro mapped Houston’s logistics corridors and identified incentives tied to workforce training. The founder secured a warehouse shortlist, negotiated rates, and started a local vendor pipeline within the first 30 days.",
    imageUrl: "/logistic-houston.png",
    authorName: "Faro community",
    createdAt: new Date().toISOString(),
  },
  {
    id: 3,
    title: "Health services founder builds in Raleigh",
    city: "Raleigh, NC",
    summary:
      "Faro recommended Raleigh based on healthcare networks and manageable costs, helping the founder land early hospital partner meetings.",
    outcomes: ["2 hospital meetings", "Pilot cohort recruited", "Grant shortlist"],
    body:
      "Faro balanced cost, network strength, and opportunity score to recommend Raleigh. The founder used Faro’s playbook to run pop‑ups, validate demand, and secure a grant shortlist while building partner trust.",
    imageUrl: "/healthcare-raleign-.png",
    authorName: "Faro community",
    createdAt: new Date().toISOString(),
  },
];

export default function StoriesPage() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";
  const [stories, setStories] = useState<Story[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [xStatus, setXStatus] = useState<{ connected: boolean; username?: string | null }>({
    connected: false,
  });
  const [showDetails, setShowDetails] = useState(false);

  const loadStories = async () => {
    const response = await fetch(`${backendUrl}/api/stories`, {
      credentials: "include",
    });
    if (!response.ok) return;
    const payload = (await response.json()) as Story[];
    setStories(payload);
  };

  const loadXStatus = async () => {
    const response = await fetch(`${backendUrl}/api/social/x/status`, {
      credentials: "include",
    });
    if (!response.ok) {
      setXStatus({ connected: false });
      return;
    }
    const payload = (await response.json()) as { connected: boolean; username?: string | null };
    setXStatus(payload);
  };

  useEffect(() => {
    loadStories();
  }, [backendUrl]);

  useEffect(() => {
    loadXStatus();
  }, [backendUrl]);

  const handleGenerate = async () => {
    if (!form.prompt.trim()) {
      setStatus("Add a prompt to generate a story.");
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const response = await fetch(`${backendUrl}/api/stories/generate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: form.prompt }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to generate story.");
      }
      setForm((prev) => ({
        ...prev,
        title: payload.title || "",
        city: payload.city || "",
        summary: payload.summary || "",
        outcomes: Array.isArray(payload.outcomes) ? payload.outcomes.join(", ") : "",
        body: payload.body || "",
      }));
      setStatus("Story draft generated. Review and save.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to generate story.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.title || !form.city || !form.summary || !form.body) {
      setStatus("Title, city, summary, and story body are required.");
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const outcomes = form.outcomes
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      const response = await fetch(`${backendUrl}/api/stories`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          city: form.city,
          summary: form.summary,
          outcomes,
          body: form.body,
          imageUrl: form.imageUrl || null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to save story.");
      }
      setForm(emptyForm);
      setStatus("Story saved and shared.");
      loadStories();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to save story.");
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({ ...prev, imageUrl: String(reader.result || "") }));
    };
    reader.readAsDataURL(file);
  };

  const handlePostToX = async (story: Story) => {
    setStatus(null);
    try {
      const response = await fetch(`${backendUrl}/api/social/x/post`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId: story.id, message: buildPostMessage(story) }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to post to X.");
      }
      setStatus(payload.message || "Queued for posting to X.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to post to X.");
    }
  };

  const displayStories = useMemo(
    () => (stories.length > 0 ? stories : sampleStories),
    [stories],
  );
  const storyCount = useMemo(() => displayStories.length, [displayStories]);

  return (
    <div className="page-shell">
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-4 pb-20 pt-10 sm:px-6 lg:px-10">
        <header className="flex flex-wrap items-center justify-between gap-6">
          <Link href="/" className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Faro"
              width={44}
              height={44}
              className="h-11 w-11 rounded-full border border-black/25 bg-white object-contain shadow-sm"
            />
            <div>
              <p className="text-lg uppercase tracking-[0.4em] font-black text-[#4f463c]">
                Faro
              </p>
              <p className="text-xs text-[#1e1a16]" style={{ fontSize: 9 }}>
                AI-powered decision intelligence for <br />
                underrepresented entrepreneurs
              </p>
            </div>
          </Link>
          <nav className="hidden items-center gap-4 text-xs font-semibold uppercase tracking-[0.3em] text-[#6a6056] lg:flex">
            <Link className="transition hover:text-[#0f766e] font-extrabold text-sm" href="/chat">
              ASK FARO (Beta)
            </Link>
            <span className="text-[#b8aba0]">|</span>
            <Link
              className="transition hover:text-[#0f766e] font-extrabold text-sm"
              href="/comparison"
            >
              COMPARE CITIES (Beta)
            </Link>
            <span className="text-[#b8aba0]">|</span>
            <Link className="transition hover:text-[#0f766e] font-extrabold text-sm" href="/stories">
              STORIES
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/chat"
              className="rounded-full bg-[#1e1a16] px-6 py-4 text-xs font-semibold text-white shadow-sm transition hover:bg-black"
            >
              Launch app
            </Link>
          </div>
        </header>

        <header className="flex flex-col gap-4">
          <p className="text-sm font-semibold uppercase tracking-[0.4em] text-[#c59a4a]">
            Stories
          </p>
          <h1 className="font-serif text-4xl text-[#1e1a16] sm:text-5xl">
            Faro-powered relocation stories
          </h1>
            <p className="max-w-2xl text-lg text-[#5a5249]">
            User-generated stories built from Faro decision intelligence for
            underrepresented entrepreneurs relocating to U.S. cities.
          </p>
          <p className="text-sm text-[#8a7d70]">
            {storyCount} stories shared across the community
          </p>
        </header>

        <section className="glass-panel rounded-3xl p-6 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              <h2 className="font-serif text-2xl text-[#1e1a16]">
                Generate a story
              </h2>
              <p className="text-sm text-[#5a5249]">
                Share a prompt and Faro will draft a relocation story you can edit
                before publishing.
              </p>
              <textarea
                value={form.prompt}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, prompt: event.target.value }))
                }
                placeholder="Prompt: e.g., Black logistics founder relocating to Houston with a 4-month runway."
                className="h-28 w-full rounded-2xl border border-black/10 bg-white/90 p-4 text-sm text-[#1e1a16] shadow-sm outline-none"
              />
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="rounded-full bg-[#1e1a16] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-black disabled:opacity-60"
                >
                  Generate story
                </button>
                <button
                  onClick={() => setForm(emptyForm)}
                  className="rounded-full border border-[#1e1a16]/20 bg-white/80 px-6 py-3 text-sm font-semibold text-[#1e1a16]"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#8a7d70]">
                Auto-post to X
              </p>
              <p className="mt-2 text-sm text-[#5a5249]">
                Connect your X account to publish story highlights directly.
              </p>
              <div className="mt-4 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-[#4f463c]">
                {xStatus.connected ? (
                  <span>Connected as @{xStatus.username || "account"}</span>
                ) : (
                  <span>Not connected</span>
                )}
              </div>
              <button
                className="mt-4 w-full rounded-full border border-[#1e1a16]/20 bg-white/80 px-4 py-3 text-sm font-semibold text-[#1e1a16]"
                onClick={() => setStatus("X OAuth will be enabled when credentials are added.")}
              >
                Connect X (coming soon)
              </button>
            </div>
          </div>
        </section>

        <section className="glass-panel rounded-3xl p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="font-serif text-2xl text-[#1e1a16]">
              Story details
            </h2>
            <button
              onClick={() => setShowDetails((prev) => !prev)}
              className="rounded-full border border-[#1e1a16]/20 bg-white/80 px-5 py-2 text-sm font-semibold text-[#1e1a16]"
            >
              {showDetails ? "Hide story details" : "Add story details"}
            </button>
          </div>
          {showDetails ? (
            <>
              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <input
                  value={form.title}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, title: event.target.value }))
                  }
                  placeholder="Title"
                  className="w-full rounded-2xl border border-black/10 bg-white/90 px-4 py-3 text-sm text-[#1e1a16]"
                />
                <input
                  value={form.city}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, city: event.target.value }))
                  }
                  placeholder="City"
                  className="w-full rounded-2xl border border-black/10 bg-white/90 px-4 py-3 text-sm text-[#1e1a16]"
                />
                <textarea
                  value={form.summary}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, summary: event.target.value }))
                  }
                  placeholder="Summary"
                  className="h-24 w-full rounded-2xl border border-black/10 bg-white/90 p-4 text-sm text-[#1e1a16] lg:col-span-2"
                />
                <textarea
                  value={form.outcomes}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, outcomes: event.target.value }))
                  }
                  placeholder="Outcomes (comma separated)"
                  className="h-20 w-full rounded-2xl border border-black/10 bg-white/90 p-4 text-sm text-[#1e1a16] lg:col-span-2"
                />
                <textarea
                  value={form.body}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, body: event.target.value }))
                  }
                  placeholder="Full story"
                  className="h-44 w-full rounded-2xl border border-black/10 bg-white/90 p-4 text-sm text-[#1e1a16] lg:col-span-2"
                />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <label className="rounded-full border border-[#1e1a16]/20 bg-white/80 px-4 py-2 text-sm font-semibold text-[#1e1a16]">
                  Upload image
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) =>
                      handleImageUpload(event.target.files?.[0] || null)
                    }
                  />
                </label>
                {form.imageUrl ? (
                  <span className="text-xs text-[#5a5249]">Image attached</span>
                ) : null}
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="rounded-full bg-[#1e1a16] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-black disabled:opacity-60"
                >
                  Save story
                </button>
              </div>
              {status ? (
                <p className="mt-4 text-sm text-[#0f766e]">{status}</p>
              ) : null}
            </>
          ) : (
            <p className="mt-4 text-sm text-[#5a5249]">
              Click “Add story details” to fill in the story fields before saving.
            </p>
          )}
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          {displayStories.map((story) => (
            <article
              key={story.id}
              className="glass-panel flex h-full flex-col overflow-hidden rounded-3xl"
            >
              <img
                src={story.imageUrl || "/banner.png"}
                alt={`${story.city} story`}
                className="h-40 w-full object-cover"
              />
              <div className="flex flex-1 flex-col gap-4 p-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-[#8a7d70]">
                    {story.city}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-[#1e1a16]">
                    {story.title}
                  </h3>
                </div>
                <p className="text-sm text-[#5a5249]">{story.summary}</p>
                <div className="space-y-2 text-xs text-[#5a5249]">
                  <p className="font-semibold text-[#1e1a16]">Outcomes</p>
                  <ul className="space-y-1">
                    {story.outcomes.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>
                <p className="text-xs text-[#8a7d70]">
                  Shared by {story.authorName || "Faro user"}
                </p>
                <div className="mt-auto flex flex-wrap gap-2">
                  <button
                    className="rounded-full border border-[#1e1a16]/10 bg-white/80 px-3 py-2 text-xs font-semibold text-[#1e1a16]"
                    onClick={() => navigator.clipboard.writeText(story.body)}
                  >
                    Copy story
                  </button>
                  <button
                    className="rounded-full border border-[#1e1a16]/10 bg-white/80 px-3 py-2 text-xs font-semibold text-[#1e1a16]"
                    onClick={() => navigator.clipboard.writeText(story.summary)}
                  >
                    Copy summary
                  </button>
                  <button
                    className={`rounded-full border border-[#1e1a16]/10 px-3 py-2 text-xs font-semibold ${
                      xStatus.connected
                        ? "bg-white/80 text-[#1e1a16]"
                        : "bg-white/40 text-[#9a8f85] cursor-not-allowed"
                    }`}
                    onClick={() => handlePostToX(story)}
                    disabled={!xStatus.connected}
                  >
                    Post to X
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>

        <footer className="mt-10 grid gap-8 border-t border-black/10 pt-8 text-sm text-[#5a5249] lg:grid-cols-[1.2fr_1fr_1.2fr_1fr]">
          <div>
            <p className="text-sm uppercase tracking-[0.4em] font-black">
              Faro
            </p>
            <p className="mt-3 text-xs text-[#1e1a16]">
              AI-powered decision intelligence for underrepresented entrepreneurs.
            </p>
            <p className="mt-3 text-sm text-[#5a5249]">
              Choose where to start, relocate, or expand—with clear guidance on
              location, funding, networks, and next steps.
            </p>
          </div>
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.4em] text-[#8a7d70]">
              Navigation
            </p>
            <div className="flex flex-col gap-2 text-sm font-semibold text-[#4f463c]">
              <Link className="transition hover:text-[#0f766e]" href="/chat">
                Chat with Faro
              </Link>
              <Link className="transition hover:text-[#0f766e]" href="/search">
                Explore Cities
              </Link>
              <span>Funding Finder</span>
              <span>Network Builder</span>
              <span>Generate Opportunity Map</span>
              <span>Generate Action Plan</span>
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.4em] text-[#8a7d70]">
              Explore Cities Across the U.S.
            </p>
            <p className="text-sm text-[#5a5249]">
              Atlanta, GA · Houston, TX · Detroit, MI · New York, NY · Los Angeles,
              CA · Chicago, IL · San Francisco, CA · Oakland, CA · San Jose, CA ·
              Austin, TX · Dallas, TX · San Antonio, TX · Miami, FL · Orlando, FL ·
              Tampa, FL · Washington, DC · Baltimore, MD · Silver Spring, MD ·
              Philadelphia, PA · Newark, NJ · Boston, MA · Cambridge, MA ·
              Seattle, WA · Tacoma, WA · Portland, OR · Denver, CO · Aurora, CO ·
              Phoenix, AZ · Tempe, AZ · Las Vegas, NV · Minneapolis, MN ·
              St. Paul, MN · St. Louis, MO · Kansas City, MO · Columbus, OH ·
              Cleveland, OH · Cincinnati, OH · Nashville, TN · Memphis, TN ·
              Charlotte, NC · Raleigh, NC · Durham, NC · Atlanta Metro · Houston
              Metro · Detroit Metro
            </p>
          </div>
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.4em] text-[#8a7d70]">
              Contact
            </p>
            <div className="flex flex-col gap-2 text-sm font-semibold text-[#4f463c]">
              <span>ask@faro.com</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-black/10 pt-6 text-sm text-[#5a5249] lg:col-span-4">
            <p>© Faro. All rights reserved.</p>
            <div className="flex flex-wrap gap-4 text-sm font-semibold text-[#4f463c]">
              <span>Privacy</span>
              <span>Terms</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
