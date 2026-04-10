"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import MarketingFooter from "./marketing-footer";

export default function Home() {
  const router = useRouter();
  const [question, setQuestion] = useState("");

  const submitQuestion = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const next = `/chat?question=${encodeURIComponent(trimmed)}`;
    router.push(next);
  };

  return (
    <div className="page-shell">
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col pb-24">
        <div className="hero-banner full-bleed">
          <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-10">
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
                  <p className="text-xs text-[#1e1a16]" style={{fontSize:9}}>
                    AI-powered decision intelligence for <br />underrepresented entrepreneurs
                  </p>
                </div>
              </Link>
              <nav className="hidden items-center gap-4 text-xs font-semibold uppercase tracking-[0.3em] text-[#6a6056] lg:flex">
                <Link
                  className="transition hover:text-[#0f766e] font-extrabold text-sm"
                  href="/chat"
                >
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
                <Link
                  className="transition hover:text-[#0f766e] font-extrabold text-sm"
                  href="/stories"
                >
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

            <section className="mt-16 space-y-10">
              <div className="space-y-4">
                <p className="text-sm font-semibold uppercase tracking-[0.4em] text-[#c59a4a]">
                  FARO
                </p>
                <h1 className="font-serif text-4xl leading-tight text-[#1e1a16] sm:text-5xl">
                  Where should you build your business—so it actually wins?
                </h1>
                <p className=" text-xl  text-[#4f463c]">
                  FARO is the AI companion for underrepresented entrepreneurs, helping
                  you start, relocate, or expand in the most inclusive and
                  opportunity-rich U.S. cities and states.
                </p>
              </div>
              <div className="glass-panel rounded-3xl p-6 sm:p-8">
                <p className="text-sm font-bold uppercase tracking-[0.35em] text-[#7a6f63]">
                  AI Question Bar
                </p>
                <form
                  className="mt-4 flex flex-col gap-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    submitQuestion(question);
                  }}
                >
                  <input
                    type="text"
                    placeholder="Ask FARO anything..."
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    className="w-full rounded-2xl border border-black/10 bg-white/95 px-5 py-5 text-lg font-semibold text-[#1e1a16] shadow-sm outline-none transition focus:border-[#0f766e]"
                  />
                  <div className="flex flex-wrap gap-3 text-sm text-[#5a5249]">
                    {[
                      "I’m launching a beauty brand—what cities offer strong foot traffic and local support?",
                      "Compare Atlanta vs. Austin for a small logistics business—costs, taxes, and incentives.",
                      "Where do underrepresented tech founders raise capital fastest with strong local networks?",
                    ].map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        className="rounded-full border border-[#1e1a16]/10 bg-white/80 px-4 py-2 text-left text-sm font-semibold transition hover:border-[#0f766e] hover:text-[#0f766e]"
                        onClick={() => submitQuestion(prompt)}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </form>
              </div>
            </section>
          </div>
        </div>

        <section className="mt-16 px-4 sm:px-6 lg:px-10">
          <div className="glass-panel rounded-3xl p-6 sm:p-8">
                <p className="text-sm font-semibold uppercase tracking-[0.4em] text-[#c59a4a]">
              What is FARO
            </p>
            <h2 className="mt-4 font-serif text-3xl text-[#1e1a16] sm:text-4xl">
              Your location strategy co-pilot—and your cheat sheet for where to build,
              move, and grow.
            </h2>
            <div className="mt-4 space-y-4 text-sm text-[#5a5249]">
              <p>
                Choosing where to start or scale a business shouldn’t require 50
                browser tabs, insider knowledge, or expensive consultants.
              </p>
              <p>FARO turns fragmented public data into clear decisions you can act on—fast.</p>
              <p>
                It aggregates and interprets cost-of-living data, workforce
                statistics, business climate indicators, local incentives, and real
                inclusion and equity signals—then explains what they mean for your
                business stage, sector, and goals.
              </p>
                <p>
                Unlike generic “best cities” lists, FARO is built specifically for
                underrepresented founders.
              </p>
              <p>
                It prioritizes practical realities—supportive ecosystems, access to
                capital, procurement pathways, and lived-experience signals—so you
                can choose places where you can actually thrive, not just survive.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-16 px-4 sm:px-6 lg:px-10">
          <div className="glass-panel rounded-3xl p-6 sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.4em] text-[#c59a4a]">
              Our Promise
            </p>
            <h2 className="mt-4 font-serif text-3xl text-[#1e1a16] sm:text-4xl">
              Everything you need to make a smart move—on one platform.
            </h2>
            <ul className="mt-6 space-y-3 text-sm text-[#5a5249]">
              <li>Find the best-fit cities for starting, relocating, or expanding</li>
              <li>Compare markets in minutes with a clear, founder-ready scorecard</li>
              <li>Surface grants and incentives you can pursue immediately</li>
              <li>
                Get a step-by-step action plan covering licenses, taxes, hiring,
                partners, and timelines etc
              </li>
            </ul>
          </div>
        </section>

        <section className="mt-16 px-4 sm:px-6 lg:px-10">
          <div className="glass-panel rounded-3xl p-6 sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.4em] text-[#c59a4a]">
              How it works
            </p>
            <h2 className="mt-3 font-serif text-3xl text-[#1e1a16]">
              Ask. Compare. Act.
            </h2>
              <p className="mt-3 text-sm text-[#5a5249]">
              You interact naturally—type or speak a question. FARO routes your request
              through specialized agents:
            </p>
            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  title: "Creation Agent",
                  body: "Identifies the best cities and states to start a business, based on early-stage costs, regulations, support ecosystems, and founder-friendly incentives.",
                },
                {
                  title: "Relocation Agent",
                  body: "Compares cities, estimates cost and tax differences, and simulates practical tradeoffs based on your current business stage.",
                },
                {
                  title: "Expansion Agent",
                  body: "Evaluates where to grow next by analyzing market size, demand fit, competitive landscape, and scaling incentives.",
                },
                {
                  title: "Funding Agent",
                  body: "Finds grants, incentives, and founder-relevant capital pathways tied to each location.",
                },
                {
                  title: "Network Agent",
                  body: "Maps mentors, partners, suppliers, accelerators, and community resources aligned with your profile.",
                },
                {
                  title: "Combine agents",
                  body: "“Run Relocation + Funding for Detroit vs. Charlotte for my construction services business.”",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-black/5 bg-white/80 p-4 text-sm text-[#5a5249]"
                >
                  <p className="text-base font-semibold text-[#1e1a16]">
                    {item.title}
                  </p>
                  <p className="mt-2">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-16 px-4 sm:px-6 lg:px-10">
          <div className="glass-panel rounded-3xl p-6 sm:p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.4em] text-[#c59a4a]">
              Core modules
            </p>
            
            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[
                {
                    title: "AI Chat (Beta)",
                    body: "Ask questions in natural language—by text or voice—and let FARO orchestrate the right agents to deliver clear, stage-aware answers and next steps.",
                },
                {
                  title: "Opportunity Map (Coming Soon)",
                  body: "Personalized city and state recommendations based on your sector, business stage, and constraints.",
                },
                {
                  title: "Compare Engine (Beta)",
                  body: "Side-by-side scorecards comparing costs, incentives, market access, workforce, and ecosystem strength.",
                },
                {
                  title: "Funding Finder (Coming Soon)",
                  body: "Grants and incentives filtered by eligibility, stage, and geography.",
                },
                {
                  title: "Network Builder (Coming Soon)",
                  body: "Local partners, programs, mentors, and suppliers matched to your business needs.",
                },
                {
                  title: "Action Plan Generator (Coming Soon)",
                  body: "A step-by-step launch, relocation, or expansion checklist you can export and execute.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-black/5 bg-white/80 p-4 text-sm text-[#5a5249]"
                >
                  <p className="text-base font-semibold text-[#1e1a16]">
                    {item.title}
                  </p>
                  <p className="mt-2">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-16 px-4 sm:px-6 lg:px-10">
          <div className="glass-panel rounded-3xl p-6 sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.4em] text-[#c59a4a]">
              Data you can trust
            </p>
            <h2 className="mt-3 font-serif text-3xl text-[#1e1a16]">
              Transparent inputs. Explainable outputs.
            </h2>
            <p className="mt-3 text-sm text-[#5a5249]">
              FARO uses open, public data sources—including government datasets,
              workforce statistics, cost indices, and incentive programs—and
              translates them into clear recommendations, showing why a city scores
              well for your specific needs.
            </p>
          </div>
        </section>

        <section className="mt-16 px-4 sm:px-6 lg:px-10">
          <div className="glass-panel rounded-3xl p-6 sm:p-8">
           
            <h2 className="mt-3 font-serif text-3xl text-[#1e1a16]">
              Built for every stage. Make your next move with clarity.
            </h2>
            <p className="mt-3 text-sm text-[#5a5249]">
              Ask a question. Get a ranked shortlist, a comparison, and an action
              plan—built for underrepresented founders.
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
              <Link
                href="/chat"
                className="rounded-full bg-[#1e1a16] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-black"
              >
                Ask FARO now
              </Link>
              <Link
                href="/search"
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-[#1e1a16]/20 bg-white/70 px-6 py-3 text-sm font-semibold text-[#1e1a16] shadow-sm transition hover:border-[#0f766e] hover:text-[#0f766e]"
              >
                Explore cities
              </Link>
            </div>
          </div>
        </section>

        <MarketingFooter />
      </div>
    </div>
  );
}
