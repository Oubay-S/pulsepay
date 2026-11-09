"use client";

import React from "react";
import { AlertOctagon, ArrowRight } from "lucide-react";
import type { ArrangementWithDetails } from "@/types/database";

interface DisputeBannerProps {
  disputes: ArrangementWithDetails[];
}

export function DisputeBanner({ disputes }: DisputeBannerProps) {
  if (!disputes || disputes.length === 0) return null;

  return (
    <div className="p-4 rounded-[10px] bg-[var(--pp-overdue-soft)] border border-[var(--pp-overdue-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[13px]">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-[10px] bg-[var(--pp-overdue)] text-white flex items-center justify-center shrink-0">
          <AlertOctagon className="w-5 h-5" />
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-[var(--pp-ink)]">
            Deliverable Dispute Intercepted ({disputes.length})
          </span>
          <span className="text-[12px] text-[var(--pp-ink-soft)]">
            Autonomous follow-ups and payment reminders immediately paused to protect merchant relationship.
          </span>
        </div>
      </div>

      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] font-bold text-[12px] bg-[var(--pp-surface)] text-[var(--pp-overdue)] border border-[var(--pp-overdue-border)] shrink-0">
        Owner Action Required
      </span>
    </div>
  );
}

