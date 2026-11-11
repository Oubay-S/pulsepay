"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  RefreshCw,
  LayoutDashboard,
  FileText,
  CheckCircle2,
  Settings2,
  ScrollText,
} from "lucide-react";
import type { DashboardKPIs, InvoicesResponse, ApprovalsResponse } from "@/types/api";
import type { InvoiceWithClient, ArrangementWithDetails } from "@/types/database";
import { createClient } from "@/lib/supabase/client";
import { KpiStrip } from "@/components/dashboard/KpiStrip";
import { AgingGrid } from "@/components/dashboard/AgingGrid";
import { PolicyPanel } from "@/components/dashboard/PolicyPanel";
import { ApprovalCard } from "@/components/dashboard/ApprovalCard";
import { InvoiceDetailDrawer } from "@/components/dashboard/InvoiceDetailDrawer";
import { LiveToast } from "@/components/dashboard/LiveToast";
import { AuditLog } from "@/components/dashboard/AuditLog";
import { DisputeBanner } from "@/components/dashboard/DisputeBanner";

// ─── Tab definitions ──────────────────────────────────────────────────────────
type TabId = "dashboard" | "invoices" | "approvals" | "policy" | "audit";

interface NavItem {
  id: TabId;
  label: string;
  Icon: React.ElementType;
  badge?: () => number | null;
}

export default function OwnerDashboard() {
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [invoices, setInvoices] = useState<InvoiceWithClient[]>([]);
  const [approvals, setApprovals] = useState<ArrangementWithDetails[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceWithClient | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [realtimeNotification, setRealtimeNotification] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const fetchData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const [invRes, appRes] = await Promise.all([
        fetch("/api/invoices"),
        fetch("/api/approvals"),
      ]);

      if (invRes.ok) {
        const invData: InvoicesResponse = await invRes.json();
        setInvoices(invData.invoices || []);
        setKpis(invData.kpis);
      }

      if (appRes.ok) {
        const appData: ApprovalsResponse = await appRes.json();
        setApprovals(appData.approvals || []);
      }
    } catch (err: any) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    try {
      const supabase = createClient();
      const channel = supabase
        .channel("pulsepay-dashboard-changes")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "invoices" },
          () => {
            setRealtimeNotification("Receivables updated live via webhook");
            setTimeout(() => setRealtimeNotification(null), 4500);
            fetchData(true);
          }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "arrangements" },
          () => {
            fetchData(true);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (e) {
      console.warn("Supabase Realtime not configured for local client:", e);
    }
  }, [fetchData]);

  // Tabs switch instantly — no exit animation, no dropped clicks.
  // The new panel fades in via .pp-tab-panel (keyed remount).
  const navigateTo = useCallback((id: TabId) => {
    setActiveTab(id);
    setSidebarOpen(false);
  }, []);

  // Close mobile sidebar on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const pendingApprovals = approvals.filter(
    (a) => !(a.terms as any)?.dispute && !(a.terms as any)?.is_dispute
  );
  const disputes = approvals.filter(
    (a) => (a.terms as any)?.dispute || (a.terms as any)?.is_dispute
  );

  const NAV: NavItem[] = [
    { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
    { id: "invoices", label: "Invoice Aging", Icon: FileText },
    {
      id: "approvals",
      label: "Approvals",
      Icon: CheckCircle2,
      badge: () => (pendingApprovals.length > 0 ? pendingApprovals.length : null),
    },
    { id: "policy", label: "Policy Controls", Icon: Settings2 },
    { id: "audit", label: "Audit Log", Icon: ScrollText },
  ];

  return (
    // App shell: the window never scrolls — only <main> does — so the header
    // can't be covered by the sidebar or bounce away on overscroll.
    <div className="h-dvh flex flex-col overflow-hidden overscroll-none bg-[var(--pp-bg)] text-[var(--pp-ink)]">

      {/* ── Top Colour-Blocked Header (Mode signature) ───────────────────── */}
      <header className="glass-nav-light bg-[var(--pp-primary)] relative z-50 shrink-0 px-4 sm:px-6 py-3 flex items-center justify-between">
        {/* Left: Logo + Mobile hamburger */}
        <div className="flex items-center gap-3">
          {/* Mobile sidebar toggle */}
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="apple-press lg:hidden p-2 rounded-[4px] text-[#FCFCFC] hover:bg-white/10 border border-[rgba(252,252,252,0.3)]"
            aria-label="Toggle navigation"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <line x1="2" y1="4" x2="14" y2="4" />
              <line x1="2" y1="8" x2="14" y2="8" />
              <line x1="2" y1="12" x2="14" y2="12" />
            </svg>
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[4px] bg-[var(--pp-lime)] text-[var(--pp-primary)] flex items-center justify-center font-bold text-sm select-none">
              P
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="pp-display text-[20px] text-[#FCFCFC]">
                  PulsePay
                </span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[var(--pp-lime-soft)] text-[var(--pp-primary)]">
                  PayPal AI
                </span>
              </div>
              <span className="text-[11px] text-[#FCFCFC]/70 hidden sm:inline">
                Receivables Recovery &amp; Autonomous Invoicing
              </span>
            </div>
          </div>
        </div>

        {/* Right: Realtime pill + actions */}
        <div className="flex items-center gap-2.5">
          {realtimeNotification && (
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full text-[11.5px] font-semibold bg-[var(--pp-recovered-soft)] text-[var(--pp-recovered)] border border-[var(--pp-recovered-border)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--pp-recovered)]" />
              {realtimeNotification}
            </div>
          )}

          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            title="Refresh receivables"
            className="apple-press p-2 rounded-[4px] text-[#FCFCFC] bg-transparent border border-[rgba(252,252,252,0.3)] hover:bg-white/10 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      {/* ── Layout: Sidebar + Main ────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Mobile scrim */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-30 bg-[#043F2E]/30 backdrop-blur-sm lg:hidden"
            style={{ animation: "pp-fade-in 200ms ease-out both" }}
          />
        )}

        {/* ── Sidebar ───────────────────────────────────────────────────── */}
        <aside
          className={[
            "fixed lg:static inset-y-0 left-0 z-40",
            "flex flex-col",
            "w-56 shrink-0",
            "bg-[var(--pp-bg)] border-r border-[var(--pp-line)]",
            // Mobile: slide in/out from left
            "transition-transform duration-[300ms]",
            "ease-[cubic-bezier(0.32,0.72,0,1)]",
            // On mobile push down below header (header = ~56px)
            "top-14 lg:top-0",
            sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          ].join(" ")}
        >
          {/* Nav label */}
          <div className="px-4 pt-5 pb-2">
            <span className="text-[10.5px] font-bold uppercase tracking-widest text-[var(--pp-ink-tertiary)]">
              Navigation
            </span>
          </div>

          {/* Nav items */}
          <nav className="flex flex-col gap-0.5 px-2 flex-1">
            {NAV.map(({ id, label, Icon, badge }) => {
              const isActive = activeTab === id;
              const badgeCount = badge?.();
              return (
                <button
                  key={id}
                  onClick={() => navigateTo(id)}
                  className={[
                    "apple-press relative w-full flex items-center gap-3 px-3 py-2.5 rounded-[4px] text-left",
                    "text-[13.5px] font-medium",
                    isActive
                      ? "bg-[var(--pp-surface-muted)] text-[var(--pp-primary)] font-semibold"
                      : "text-[var(--pp-ink-soft)] hover:text-[var(--pp-ink)] hover:bg-[var(--pp-surface-soft)]",
                  ].join(" ")}
                  aria-current={isActive ? "page" : undefined}
                >
                  {isActive && <span className="sidebar-active-indicator" aria-hidden />}
                  <Icon
                    className={`w-4 h-4 shrink-0 ${isActive ? "text-[var(--pp-primary)]" : "text-[var(--pp-ink-tertiary)]"}`}
                  />
                  <span className="flex-1 truncate">{label}</span>
                  {badgeCount != null && (
                    <span className="shrink-0 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-[var(--pp-due)] text-white text-[10px] font-bold px-1">
                      {badgeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* ── Main Content ──────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto">
          {/* Always-mounted global alerts */}
          <DisputeBanner disputes={disputes} />

          <div
            key={activeTab}
            className="pp-tab-panel px-4 sm:px-6 lg:px-8 pt-6 pb-8 flex flex-col gap-5"
          >
            {/* ── Dashboard ── */}
            {activeTab === "dashboard" && (
              <>
                <SectionHeader
                  title="Receivables Dashboard"
                />
                <KpiStrip kpis={kpis} loading={loading} />

                {/* Quick-access cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <QuickCard
                    label="Invoice Aging Table"
                    description="View all overdue invoices, aging buckets, and trigger AI follow-ups."
                    cta="Open Table"
                    onClick={() => navigateTo("invoices")}
                    accent="accent"
                  />
                  <QuickCard
                    label="Approvals Queue"
                    description={
                      pendingApprovals.length > 0
                        ? `${pendingApprovals.length} proposal${pendingApprovals.length !== 1 ? "s" : ""} waiting for your sign-off.`
                        : "No pending approvals — the agent is running autonomously."
                    }
                    cta="Review"
                    onClick={() => navigateTo("approvals")}
                    accent="due"
                    badge={pendingApprovals.length > 0 ? pendingApprovals.length : undefined}
                  />
                  <QuickCard
                    label="Policy Controls"
                    description="Configure discount limits, installment rules, approval thresholds, and agent tone."
                    cta="Configure"
                    onClick={() => navigateTo("policy")}
                    accent="ink"
                  />
                </div>

                {/* Condensed recent approvals preview */}
                {pendingApprovals.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <SectionLabel>Recent Approval Requests</SectionLabel>
                      <button
                        onClick={() => navigateTo("approvals")}
                        className="apple-press text-[12px] font-semibold text-[var(--pp-accent)] hover:underline"
                      >
                        View all →
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {pendingApprovals.slice(0, 2).map((app) => (
                        <ApprovalCard
                          key={app.id}
                          approval={app as any}
                          onActionComplete={() => fetchData(true)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── Invoice Aging ── */}
            {activeTab === "invoices" && (
              <>
                <SectionHeader
                  title="Invoice Aging &amp; Negotiation"
                />
                <AgingGrid
                  invoices={invoices}
                  loading={loading}
                  onRefresh={() => fetchData(true)}
                  onSelectInvoice={(inv) => setSelectedInvoice(inv)}
                />
              </>
            )}

            {/* ── Approvals ── */}
            {activeTab === "approvals" && (
              <>
                <SectionHeader
                  title="Approvals Queue"
                />
                {approvals.length === 0 ? (
                  <EmptyState
                    icon={<CheckCircle2 className="w-9 h-9 text-[var(--pp-recovered)]" />}
                    title="All caught up"
                    description="No proposals require your sign-off right now. The agent is operating within policy."
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {approvals.map((app) => (
                      <ApprovalCard
                        key={app.id}
                        approval={app as any}
                        onActionComplete={() => fetchData(true)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ── Policy ── */}
            {activeTab === "policy" && (
              <>
                <SectionHeader
                  title="Policy Controls"
                />
                <PolicyPanel onSaved={() => fetchData(true)} />
              </>
            )}

            {/* ── Audit Log ── */}
            {activeTab === "audit" && (
              <>
                <SectionHeader
                  title="Audit Log"
                />
                <AuditLog />
              </>
            )}
          </div>
        </main>
      </div>

      {/* ── Global overlays (always mounted) ────────────────────────────── */}
      <LiveToast onPaymentReceived={() => fetchData(true)} />
      <InvoiceDetailDrawer
        invoice={selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
      />
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <h1
      className="pp-display text-[40px] lg:text-[54px] leading-none! tracking-[-0.025em]! text-[var(--pp-ink)]"
      dangerouslySetInnerHTML={{ __html: title }}
    />
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11.5px] font-bold uppercase tracking-widest text-[var(--pp-ink-faint)]">
      {children}
    </span>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="p-4 rounded-2xl bg-[var(--pp-surface-muted)]">{icon}</div>
      <div>
        <p className="text-[15px] font-bold text-[var(--pp-ink)]">{title}</p>
        <p className="text-[13px] text-[var(--pp-ink-soft)] mt-0.5 max-w-sm">{description}</p>
      </div>
    </div>
  );
}

type QuickCardAccent = "accent" | "due" | "ink";

function QuickCard({
  label,
  description,
  cta,
  onClick,
  accent,
  badge,
}: {
  label: string;
  description: string;
  cta: string;
  onClick: () => void;
  accent: QuickCardAccent;
  badge?: number;
}) {
  const accentMap: Record<QuickCardAccent, { dot: string; btn: string; text: string }> = {
    accent: {
      dot: "bg-[var(--pp-accent)]",
      btn: "bg-[var(--pp-accent-soft)] text-[var(--pp-accent)] border-[var(--pp-accent-border)]",
      text: "text-[var(--pp-accent)]",
    },
    due: {
      dot: "bg-[var(--pp-due)]",
      btn: "bg-[var(--pp-due-soft)] text-[var(--pp-due)] border-[var(--pp-due-border)]",
      text: "text-[var(--pp-due)]",
    },
    ink: {
      dot: "bg-[var(--pp-ink)]",
      btn: "bg-[var(--pp-surface-muted)] text-[var(--pp-ink-soft)] border-[var(--pp-line)]",
      text: "text-[var(--pp-ink-soft)]",
    },
  };
  const a = accentMap[accent];

  return (
    <button
      onClick={onClick}
      className="apple-card-light apple-press text-left p-5 flex flex-col gap-3 w-full group cursor-pointer"
    >
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full shrink-0 ${a.dot}`} />
        <span className="text-[13.5px] font-bold text-[var(--pp-ink)] tracking-tight leading-tight flex-1">
          {label}
        </span>
        {badge != null && (
          <span className="min-w-[20px] h-5 flex items-center justify-center rounded-full bg-[var(--pp-due)] text-white text-[10.5px] font-bold px-1.5">
            {badge}
          </span>
        )}
      </div>
      <p className="text-[12.5px] text-[var(--pp-ink-soft)] leading-relaxed">{description}</p>
      <span
        className={`self-start inline-flex items-center gap-1 px-3 py-1 rounded-lg text-[12px] font-semibold border ${a.btn} transition-opacity`}
      >
        {cta} →
      </span>
    </button>
  );
}
