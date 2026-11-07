"use client";

import React, { useState } from "react";
import { Clock, Plus, RotateCcw, Loader2, Sparkles } from "lucide-react";

interface DemoClockProps {
  onRefresh?: () => void;
}

export function DemoClock({ onRefresh }: DemoClockProps) {
  const [advancing, setAdvancing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleAdvance = async (days: number) => {
    try {
      setAdvancing(true);
      setStatusMessage(null);
      const res = await fetch("/api/demo/clock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days }),
      });

      if (!res.ok) throw new Error("Failed to advance demo clock");
      const data = await res.json();
      setStatusMessage(`+${days}d (${new Date(data.demo_now).toLocaleDateString()})`);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(err.message || "Failed to advance clock");
    } finally {
      setAdvancing(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Reset demo data and restore initial hackathon scenarios?")) return;
    try {
      setResetting(true);
      setStatusMessage(null);
      const res = await fetch("/api/demo/reset", {
        method: "POST",
      });

      if (!res.ok) throw new Error("Failed to reset demo");
      setStatusMessage("Demo scenarios reset");
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(err.message || "Failed to reset demo");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-xl bg-[var(--pp-surface)] border border-[var(--pp-line)] shadow-sm">
      <div className="flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-semibold text-[var(--pp-ink-soft)]">
        <Clock className="w-3.5 h-3.5 text-[var(--pp-accent)]" />
        <span>Demo Clock</span>
      </div>

      <div className="h-4 w-[1px] bg-[var(--pp-line)] hidden sm:block" />

      {/* Quick Advance Controls */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => handleAdvance(1)}
          disabled={advancing || resetting}
          className="apple-press inline-flex items-center gap-1 px-3 py-1 text-[11.5px] font-semibold rounded-lg bg-[var(--pp-surface-muted)] hover:bg-[var(--pp-line)] text-[var(--pp-ink)] border border-[var(--pp-line)] disabled:opacity-50"
        >
          {advancing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
          +1 Day
        </button>

        <button
          onClick={() => handleAdvance(7)}
          disabled={advancing || resetting}
          className="apple-press inline-flex items-center gap-1 px-3 py-1 text-[11.5px] font-semibold rounded-lg bg-[var(--pp-accent-soft)] hover:bg-[var(--pp-accent-tint)] text-[var(--pp-accent)] border border-[var(--pp-accent-border)] disabled:opacity-50"
        >
          {advancing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          +7 Days (Trigger Due)
        </button>
      </div>

      <div className="h-4 w-[1px] bg-[var(--pp-line)] hidden sm:block" />

      {/* Reset */}
      <button
        onClick={handleReset}
        disabled={advancing || resetting}
        className="apple-press inline-flex items-center gap-1 px-2.5 py-1 text-[11.5px] font-medium rounded-lg text-[var(--pp-ink-faint)] hover:text-[var(--pp-overdue)] hover:bg-[var(--pp-overdue-soft)] transition-colors disabled:opacity-50"
      >
        <RotateCcw className={`w-3 h-3 ${resetting ? "animate-spin" : ""}`} />
        <span>Reset</span>
      </button>

      {statusMessage && (
        <span className="text-[11.5px] font-semibold text-[var(--pp-recovered)] ml-auto px-2">
          {statusMessage}
        </span>
      )}
    </div>
  );
}
