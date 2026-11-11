"use client";

import React, { useState } from "react";
import { Check, X, ShieldAlert, Loader2 } from "lucide-react";
import type { ArrangementWithDetails } from "@/types/database";

interface ApprovalWithInvoiceClient extends ArrangementWithDetails {
  invoice: ArrangementWithDetails['invoice'] & {
    client?: {
      name?: string;
      email?: string;
    };
  };
}

interface ApprovalCardProps {
  approval: ApprovalWithInvoiceClient;
  onActionComplete?: () => void;
}

export function ApprovalCard({ approval, onActionComplete }: ApprovalCardProps) {
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const invoice = approval.invoice;
  const client = invoice?.client;
  const terms: any = approval.terms || {};

  // Check if terms define an executable proposal rather than an unvalidated client demand
  const isExecutable =
    terms.type === "discount" ||
    terms.type === "plan" ||
    terms.type === "pay_later" ||
    (terms.discount_percentage != null && !terms.requested_discount_pct);

  const handleAction = async (action: "approve" | "reject") => {
    try {
      setSubmitting(true);
      setActionError(null);

      const res = await fetch(`/api/approvals/${approval.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Failed to ${action} proposal`);
      }

      if (onActionComplete) onActionComplete();
    } catch (err: any) {
      setActionError(err.message || "Action failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="apple-card-light p-5 flex flex-col justify-between gap-4 border-l-4 border-l-[var(--pp-due)]">
      {/* Top Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[14px] font-bold text-[var(--pp-ink)]">
            {client?.name || "Client"}
          </span>
          <span className="text-[11.5px] font-semibold px-2.5 py-0.5 rounded-full bg-[var(--pp-due-soft)] text-[var(--pp-due)] border border-[var(--pp-due-border)]">
            {approval.type} Request
          </span>
        </div>
        <span className="text-[12px] text-[var(--pp-ink-soft)]">
          Invoice #{invoice?.paypal_invoice_id} · Total: ${Number(invoice?.amount || 0).toLocaleString()}
        </span>
      </div>

      {/* Rationale / Terms Breakdown */}
      <div className="p-3.5 rounded-xl bg-[var(--pp-surface-muted)] border border-[var(--pp-line)] flex flex-col gap-2 text-[12px]">
        <div className="flex items-center justify-between text-[var(--pp-ink)]">
          <span className="font-semibold text-[var(--pp-ink-soft)]">Proposed Terms:</span>
          <span className="font-bold text-[var(--pp-accent)] tnum">
            {approval.type === "DISCOUNT" && `${terms.discount_percentage || terms.requested_discount_pct || 0}% Early Discount`}
            {approval.type === "PLAN" && `${terms.number_of_installments || 0} installments of $${terms.installment_amount || 0}`}
            {approval.type === "PAY_LATER" && "PayPal Pay Later Application"}
          </span>
        </div>

        {(terms.reason || terms.reasoning) && (
          <p className="text-[11.5px] text-[var(--pp-ink-soft)] italic leading-relaxed">
            "{terms.reason || terms.reasoning}"
          </p>
        )}

        {!isExecutable && (
          <p className="text-[11px] text-[var(--pp-due)] font-medium pt-1 border-t border-[var(--pp-line)]">
            Client requested custom terms exceeding policy. Requires counter-offer or rejection.
          </p>
        )}
      </div>

      {actionError && (
        <span className="text-[11.5px] text-[var(--pp-overdue)] font-semibold flex items-center gap-1">
          <ShieldAlert className="w-3.5 h-3.5" /> {actionError}
        </span>
      )}

      {/* Decision Buttons */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--pp-line)]">
        <button
          onClick={() => handleAction("reject")}
          disabled={submitting}
          className="apple-press inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-[12px] font-semibold text-[var(--pp-ink-soft)] hover:text-[var(--pp-overdue)] hover:bg-[var(--pp-overdue-soft)] transition-colors disabled:opacity-50"
        >
          <X className="w-3.5 h-3.5" /> Reject
        </button>

        <button
          onClick={() => handleAction("approve")}
          disabled={submitting || !isExecutable}
          title={!isExecutable ? "Client requests cannot be executed directly. Reject or counter." : undefined}
          className="apple-press inline-flex items-center gap-1.5 px-4 py-1.5 rounded-[4px] text-[12px] font-bold bg-[var(--pp-primary)] hover:bg-[var(--pp-primary-strong)] text-[var(--pp-on-primary)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Check className="w-3.5 h-3.5" />
          )}
          Sign-Off & Execute
        </button>
      </div>
    </div>
  );
}
