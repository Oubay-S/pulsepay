"use client";

import React from "react";

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const normalized = (status || "").toUpperCase();

  let label = normalized;
  let bg = "bg-[var(--pp-surface-muted)]";
  let text = "text-[var(--pp-ink-soft)]";
  let border = "border-[var(--pp-line)]";
  let dot = "bg-[var(--pp-ink-tertiary)]";

  switch (normalized) {
    case "PAID":
      label = "Paid";
      bg = "bg-[var(--pp-recovered-soft)]";
      text = "text-[var(--pp-recovered)]";
      border = "border-[var(--pp-recovered-border)]";
      dot = "bg-[var(--pp-recovered)]";
      break;

    case "SENT":
      label = "Awaiting";
      bg = "bg-[var(--pp-accent-soft)]";
      text = "text-[var(--pp-accent)]";
      border = "border-[var(--pp-accent-border)]";
      dot = "bg-[var(--pp-accent)]";
      break;

    case "PARTIALLY_PAID":
      label = "Staged Plan";
      bg = "bg-[var(--pp-due-soft)]";
      text = "text-[var(--pp-due)]";
      border = "border-[var(--pp-due-border)]";
      dot = "bg-[var(--pp-due)]";
      break;

    case "CANCELLED":
    case "SUPERSEDED":
      label = normalized === "SUPERSEDED" ? "Restructured" : "Void";
      bg = "bg-[var(--pp-surface-soft)]";
      text = "text-[var(--pp-ink-tertiary)]";
      border = "border-[var(--pp-line)]";
      dot = "bg-[var(--pp-ink-tertiary)]";
      break;

    default:
      label = normalized;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold border ${bg} ${text} ${border}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

interface PriorityBadgeProps {
  score: number;
  reason?: string | null;
}

export function PriorityBadge({ score, reason }: PriorityBadgeProps) {
  let badgeStyle = "bg-[var(--pp-surface-muted)] text-[var(--pp-ink-soft)] border-[var(--pp-line)]";
  let dotColor = "bg-[var(--pp-ink-tertiary)]";

  if (score >= 70) {
    badgeStyle = "bg-[var(--pp-overdue-soft)] text-[var(--pp-overdue)] border-[var(--pp-overdue-border)]";
    dotColor = "bg-[var(--pp-overdue)]";
  } else if (score >= 40) {
    badgeStyle = "bg-[var(--pp-due-soft)] text-[var(--pp-due)] border-[var(--pp-due-border)]";
    dotColor = "bg-[var(--pp-due)]";
  } else {
    badgeStyle = "bg-[var(--pp-recovered-soft)] text-[var(--pp-recovered)] border-[var(--pp-recovered-border)]";
    dotColor = "bg-[var(--pp-recovered)]";
  }

  return (
    <div className="relative group inline-flex items-center cursor-help">
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11.5px] font-bold border tabular-nums ${badgeStyle}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
        {score}
      </span>

      {reason && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 w-64 p-3 text-[11.5px] font-normal leading-relaxed rounded-xl shadow-lg bg-[var(--pp-surface)] border border-[var(--pp-line-strong)] text-[var(--pp-ink)] pointer-events-none transition-all">
          <div className="font-semibold text-[10.5px] uppercase tracking-wider text-[var(--pp-accent)] mb-1">
            Explainable AI Rationale
          </div>
          {reason}
        </div>
      )}
    </div>
  );
}
