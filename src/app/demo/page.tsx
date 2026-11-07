"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Smartphone, Sparkles, ExternalLink, RefreshCw } from "lucide-react";
import OwnerDashboard from "../page";

export default function DemoSplitViewPage() {
  const [selectedToken, setSelectedToken] = useState<string>("demo-inv2-marcus-002");

  const scenarios = [
    {
      token: "demo-inv2-marcus-002",
      name: "Marcus Rivera ($1,200)",
      story: "Can't pay in full → 3×$400 staged plan",
    },
    {
      token: "demo-inv2-sarah-001",
      name: "Sarah Chen ($850)",
      story: "Forgot invoice → friendly reminder → full payment",
    },
    {
      token: "demo-inv2-alex-003",
      name: "Alex Thompson ($3,500)",
      story: "Aggressive concession → Guard blocks → Owner counter",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[var(--pp-bg-deep)] text-[var(--pp-ink)]">
      {/* Top Demo Bar */}
      <div className="px-5 py-3 border-b border-[var(--pp-line)] bg-[var(--pp-surface)] flex flex-wrap items-center justify-between gap-3 z-50">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="apple-press inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-[var(--pp-ink-soft)] hover:text-[var(--pp-ink)] rounded-lg bg-[var(--pp-surface-muted)] border border-[var(--pp-line)] shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </Link>

          <span className="text-[13px] font-bold text-[var(--pp-ink)] flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-[var(--pp-accent)]" />
            Hackathon Interactive Split View
          </span>
        </div>

        {/* Scenario Switcher */}
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold text-[var(--pp-ink-soft)] hidden sm:inline">
            Active Scenario:
          </span>
          <div className="inline-flex p-1 rounded-xl bg-[var(--pp-surface-muted)] border border-[var(--pp-line)]">
            {scenarios.map((s) => (
              <button
                key={s.token}
                onClick={() => setSelectedToken(s.token)}
                className={`apple-press px-3 py-1 text-[12px] font-semibold rounded-lg transition-all ${
                  selectedToken === s.token
                    ? "bg-[var(--pp-primary)] text-white shadow-sm"
                    : "text-[var(--pp-ink-soft)] hover:text-[var(--pp-ink)]"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Side-by-Side Dual Pane */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Pane: Owner Dashboard */}
        <div className="flex-1 overflow-y-auto border-r border-[var(--pp-line)] max-h-[calc(100vh-53px)]">
          <OwnerDashboard />
        </div>

        {/* Right Pane: Soulaimane's Official Client Portal */}
        <div className="w-full lg:w-[480px] shrink-0 bg-[var(--pp-surface)] border-t lg:border-t-0 border-[var(--pp-line)] flex flex-col max-h-[calc(100vh-53px)] shadow-2xl">
          <div className="px-4 py-3 bg-[var(--pp-surface-soft)] border-b border-[var(--pp-line)] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[12px] font-bold text-[var(--pp-ink)]">
              <Smartphone className="w-4 h-4 text-[var(--pp-accent)]" />
              <span>Client Mobile View</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-[var(--pp-ink-faint)] hidden sm:inline truncate max-w-[200px]">
                {scenarios.find((s) => s.token === selectedToken)?.story}
              </span>

              <a
                href={`/c/${selectedToken}`}
                target="_blank"
                rel="noreferrer"
                title="Open client page in new tab"
                className="apple-press p-1.5 rounded-lg text-[var(--pp-ink-soft)] hover:text-[var(--pp-ink)] hover:bg-[var(--pp-surface-muted)] border border-[var(--pp-line)]"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Live Mobile Client Portal Iframe */}
          <div className="flex-1 bg-[var(--pp-bg-deep)] p-2 sm:p-3 overflow-hidden flex flex-col items-center justify-center">
            <div className="w-full h-full max-w-[420px] bg-white rounded-[24px] shadow-lg border border-[var(--pp-line-strong)] overflow-hidden flex flex-col">
              {/* Simulated iOS status indicator notch */}
              <div className="w-full h-4 bg-slate-900/5 flex items-center justify-center shrink-0">
                <div className="w-16 h-1 rounded-full bg-slate-400/40" />
              </div>
              <iframe
                key={selectedToken}
                src={`/c/${selectedToken}`}
                title="Client Portal Preview"
                className="w-full flex-1 border-0"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
