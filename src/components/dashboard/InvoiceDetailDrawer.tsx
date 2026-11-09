"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  Calendar,
  User,
  Clock,
  ExternalLink,
  Loader2,
  FileText,
  Sparkles,
} from "lucide-react";
import type { InvoiceWithClient } from "@/types/database";
import type { ClientPageData } from "@/types/api";
import { StatusBadge, PriorityBadge } from "./Badges";

interface InvoiceDetailDrawerProps {
  invoice: InvoiceWithClient | null;
  onClose: () => void;
}

/** Resolve the portal conversation token for a given PayPal invoice ID. */
function resolvePortalToken(paypalInvoiceId: string): string {
  const tokenMap: Record<string, string> = {
    "INV2-SARAH-001": "demo-inv2-sarah-001",
    "INV2-MARCUS-002": "demo-inv2-marcus-002",
    "INV2-ALEX-003": "demo-inv2-alex-003",
  };
  return tokenMap[paypalInvoiceId] ?? `demo-${paypalInvoiceId.toLowerCase()}`;
}

export function InvoiceDetailDrawer({ invoice, onClose }: InvoiceDetailDrawerProps) {
  const [portalData, setPortalData] = useState<ClientPageData | null>(null);
  const [loading, setLoading] = useState(false);

  // Derive the portal token once — used both for fetching and the footer link
  const portalToken = invoice ? resolvePortalToken(invoice.paypal_invoice_id) : null;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!invoice || !portalToken) {
      setPortalData(null);
      return;
    }

    async function loadThread() {
      try {
        setLoading(true);

        const res = await fetch(`/api/c/${portalToken}`);
        if (res.ok) {
          const data: ClientPageData = await res.json();
          setPortalData(data);
        } else {
          setPortalData(null);
        }
      } catch (e) {
        console.warn("Could not load portal conversation thread:", e);
      } finally {
        setLoading(false);
      }
    }

    loadThread();
  }, [invoice, portalToken]);

  if (!invoice) return null;

  const client = invoice.client;
  const amountFormatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: invoice.currency || "USD",
  }).format(Number(invoice.amount) || 0);

  const dueDateFormatted = new Date(invoice.due_date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Scrim */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-[#043F2E]/40 backdrop-blur-sm transition-opacity duration-300 animate-fade-in"
      />

      {/* Drawer Panel */}
      <div
        className="relative z-10 w-full max-w-lg bg-[var(--pp-surface)] border-l border-[var(--pp-line)] shadow-2xl flex flex-col h-full transform transition-transform duration-300 ease-out"
      >
        {/* Header */}
        <div className="p-5 border-b border-[var(--pp-line)] bg-[var(--pp-surface)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--pp-surface-muted)] text-[var(--pp-accent)] flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[15px] font-bold text-[var(--pp-ink)] tracking-tight">
                  Invoice #{invoice.paypal_invoice_id}
                </h3>
                <StatusBadge status={invoice.status} />
              </div>
              <span className="text-[12px] text-[var(--pp-ink-soft)]">
                Receivable Details & Negotiation Log
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="apple-press p-1.5 rounded-lg text-[var(--pp-ink-soft)] hover:text-[var(--pp-ink)] hover:bg-[var(--pp-surface-muted)] border border-[var(--pp-line)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
          {/* Amount Card */}
          <div className="apple-card-light p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[11.5px] font-semibold uppercase tracking-wider text-[var(--pp-ink-faint)]">
                Receivable Total
              </span>
              <PriorityBadge
                score={Number(invoice.priority_score) || 0}
                reason={invoice.priority_reason}
              />
            </div>
            <div className="text-[28px] font-bold text-[var(--pp-ink)] tnum">
              {amountFormatted}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[var(--pp-line)] text-[12px]">
              <div>
                <span className="text-[var(--pp-ink-faint)] block">Due Date:</span>
                <span className="font-semibold text-[var(--pp-ink)]">{dueDateFormatted}</span>
              </div>
              <div>
                <span className="text-[var(--pp-ink-faint)] block">Client On-Time Rate:</span>
                <span className="font-semibold text-[var(--pp-recovered)] tnum">
                  {client?.on_time_rate ? `${client.on_time_rate}%` : "New Client"}
                </span>
              </div>
            </div>
          </div>

          {/* Client Info */}
          <div className="apple-card-light p-4 flex flex-col gap-1.5">
            <span className="text-[11.5px] font-semibold uppercase tracking-wider text-[var(--pp-ink-faint)] flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[var(--pp-accent)]" /> Client Information
            </span>
            <span className="font-bold text-[14px] text-[var(--pp-ink)]">
              {client?.name || "Client"}
            </span>
            <span className="text-[12.5px] text-[var(--pp-ink-soft)]">
              {client?.email || "No email recorded"}
            </span>
          </div>

          {/* AI Priority Rationale */}
          {invoice.priority_reason && (
            <div className="p-4 rounded-xl bg-[var(--pp-surface-soft)] border border-[var(--pp-line)] flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--pp-accent)] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> AI Priority Rationale
              </span>
              <p className="text-[12.5px] text-[var(--pp-ink)] leading-relaxed">
                {invoice.priority_reason}
              </p>
            </div>
          )}

          {/* Conversation Log */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--pp-ink-faint)] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[var(--pp-accent)]" /> Negotiation History
              </span>
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--pp-accent)]" />}
            </div>

            {portalData && portalData.messages && portalData.messages.length > 0 ? (
              <div className="flex flex-col gap-2.5">
                {portalData.messages.map((m) => {
                  const isClient = m.sender === "CLIENT";
                  const isOwner = m.sender === "OWNER";
                  
                  let senderLabel = "PulsePay Agent";
                  let bubbleClass = "mr-auto bg-[var(--pp-lime-soft)] text-[var(--pp-ink)] rounded-[16px_16px_16px_0]";
                  
                  if (isClient) {
                    senderLabel = "Client";
                    bubbleClass = "ml-auto bg-[var(--pp-primary)] text-[#FCFCFC] rounded-[16px_16px_0_16px]";
                  } else if (isOwner) {
                    senderLabel = "Business Owner";
                    bubbleClass = "mr-auto bg-[var(--pp-surface-muted)] text-[var(--pp-ink)] rounded-[16px_16px_16px_4px]";
                  }

                  return (
                    <div
                      key={m.id}
                      className={`p-3 text-[12.5px] leading-relaxed max-w-[90%] ${bubbleClass}`}
                    >
                      <div className="text-[10px] font-bold opacity-75 mb-1">
                        {senderLabel}
                      </div>
                      {m.content}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-dashed border-[var(--pp-line)] text-center text-[12px] text-[var(--pp-ink-faint)]">
                No active conversation for this invoice yet. Trigger a follow-up from the table to begin.
              </div>
            )}
          </div>

          {/* Staged Installments */}
          {portalData && portalData.offers && portalData.offers.some((o: any) => o.installments?.length > 0) && (
            <div className="flex flex-col gap-2.5">
              <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--pp-ink-faint)] flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[var(--pp-accent)]" /> Staged Installment Schedule
              </span>
              <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-[var(--pp-surface)] border border-[var(--pp-line)]">
                {portalData.offers.flatMap((o: any) => o.installments || []).map((inst: any, idx: number) => (
                  <div key={inst.id || idx} className="flex items-center justify-between text-[12px] py-1 border-b border-[var(--pp-line)] last:border-0">
                    <span className="font-semibold text-[var(--pp-ink)]">
                      Part {inst.number}: ${Number(inst.amount).toLocaleString()}
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[var(--pp-surface-muted)] border border-[var(--pp-line)] text-[var(--pp-ink-soft)] uppercase">
                      {inst.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--pp-line)] bg-[var(--pp-surface)] flex items-center justify-between">
          <button
            onClick={onClose}
            className="apple-press px-4 py-2 rounded-[4px] text-[12.5px] font-semibold text-[var(--pp-ink-soft)] hover:text-[var(--pp-ink)] hover:bg-[var(--pp-surface-muted)]"
          >
            Close
          </button>

          <a
            href={`/c/${portalToken}`}
            target="_blank"
            rel="noreferrer"
            className="apple-press inline-flex items-center gap-1.5 px-4 py-2 rounded-[4px] text-[12.5px] font-bold bg-[var(--pp-primary)] hover:bg-[var(--pp-primary-strong)] text-[var(--pp-on-primary)]"
          >
            <span>Open Client Link</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
