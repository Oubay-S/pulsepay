"use client";

import React from "react";
import {
  Clock,
  AlertCircle,
  CheckCircle2,
  Inbox,
} from "lucide-react";
import type { DashboardKPIs } from "@/types/api";

interface KpiStripProps {
  kpis: DashboardKPIs | null;
  loading?: boolean;
}

export function KpiStrip({ kpis, loading }: KpiStripProps) {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const cards = [
    {
      id: "outstanding",
      label: "Total Outstanding",
      value: kpis ? formatCurrency(kpis.total_outstanding) : "$0",
      caption: `${kpis?.total_invoices ?? 0} active receivables`,
      icon: Clock,
      tint: "text-[var(--pp-primary)]",
      bgTint: "bg-[var(--pp-surface-muted)]",
      borderAccent: "",
    },
    {
      id: "overdue",
      label: "Overdue Exposure",
      value: kpis ? formatCurrency(kpis.total_overdue) : "$0",
      caption: "Requiring agent follow-up",
      icon: AlertCircle,
      tint: "text-[var(--pp-overdue)]",
      bgTint: "bg-[var(--pp-overdue-soft)]",
      borderAccent: "border-l-4 border-l-[var(--pp-overdue)]",
    },
    {
      id: "recovered",
      label: "Recovered This Month",
      value: kpis ? formatCurrency(kpis.recovered_this_month) : "$0",
      caption: "Settled via early discount & plans",
      icon: CheckCircle2,
      tint: "text-[var(--pp-recovered)]",
      bgTint: "bg-[var(--pp-recovered-soft)]",
      borderAccent: "border-l-4 border-l-[var(--pp-recovered)]",
    },
    {
      id: "approval",
      label: "Pending Approvals",
      value: kpis ? kpis.needs_approval.toString() : "0",
      caption:
        kpis?.needs_approval && kpis.needs_approval > 0
          ? "Exceptions awaiting sign-off"
          : "All arrangements within policy",
      icon: Inbox,
      tint: "text-[var(--pp-due)]",
      bgTint: "bg-[var(--pp-due-soft)]",
      borderAccent:
        kpis && kpis.needs_approval > 0
          ? "border-l-4 border-l-[var(--pp-due)]"
          : "",
    },
  ];

  return (
    <section aria-label="Receivables Overview" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.id}
            className={`apple-card-light p-5 flex flex-col justify-between ${card.borderAccent}`}
          >
            {/* Header: Label & Icon */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11.5px] font-semibold tracking-wider uppercase text-[var(--pp-ink-faint)]">
                {card.label}
              </span>
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center ${card.bgTint} ${card.tint}`}
              >
                <Icon className="w-4 h-4" strokeWidth={2.2} />
              </div>
            </div>

            {/* Metric Value */}
            <div className="my-1">
              {loading ? (
                <div className="h-8 w-28 bg-[var(--pp-surface-muted)] animate-pulse rounded-lg" />
              ) : (
                <div className="text-[28px] font-bold text-[var(--pp-ink)] tracking-tight tnum leading-tight">
                  {card.value}
                </div>
              )}
            </div>

            {/* Caption */}
            <div className="flex items-center gap-1.5 mt-2 text-[12px] text-[var(--pp-ink-soft)]">
              {loading ? (
                <div className="h-3 w-32 bg-[var(--pp-surface-muted)] animate-pulse rounded" />
              ) : (
                <span>{card.caption}</span>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}
