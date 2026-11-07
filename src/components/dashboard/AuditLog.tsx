"use client";

import React, { useEffect, useState } from "react";
import { History, RefreshCw, Loader2 } from "lucide-react";
import type { EventRow } from "@/types/database";

export function AuditLog() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/events?limit=8");
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch (e) {
      console.warn("Audit log fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  return (
    <div className="apple-card-light p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-[var(--pp-line)] pb-3">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-[var(--pp-accent)]" />
          <h3 className="text-[14px] font-bold text-[var(--pp-ink)] tracking-tight">
            System & Agent Audit Trail
          </h3>
        </div>
        <button
          onClick={fetchEvents}
          disabled={loading}
          className="apple-press p-1.5 rounded-lg text-[var(--pp-ink-soft)] hover:text-[var(--pp-ink)]"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading && events.length === 0 ? (
        <div className="py-6 flex justify-center text-[var(--pp-ink-soft)]">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : events.length === 0 ? (
        <div className="text-[12px] text-[var(--pp-ink-faint)] text-center py-4">
          No events recorded yet. Actions by the Agent and PayPal executor will appear here.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {events.map((ev) => {
            const isOwner = ev.actor === "OWNER";
            const isPaypal = ev.actor === "PAYPAL";

            let actorBadge = "bg-[var(--pp-accent-soft)] text-[var(--pp-accent)] border-[var(--pp-accent-border)]";
            if (isOwner) actorBadge = "bg-[var(--pp-due-soft)] text-[var(--pp-due)] border-[var(--pp-due-border)]";
            if (isPaypal) actorBadge = "bg-[var(--pp-recovered-soft)] text-[var(--pp-recovered)] border-[var(--pp-recovered-border)]";

            return (
              <div
                key={ev.id}
                className="p-3 rounded-xl bg-[var(--pp-surface-soft)] border border-[var(--pp-line)] flex items-center justify-between gap-3 text-[12px]"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${actorBadge}`}
                  >
                    {ev.actor}
                  </span>
                  <span className="font-semibold text-[var(--pp-ink)]">
                    {ev.type.replace(/_/g, " ")}
                  </span>
                </div>
                <span className="text-[11px] text-[var(--pp-ink-faint)] tnum">
                  {new Date(ev.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
