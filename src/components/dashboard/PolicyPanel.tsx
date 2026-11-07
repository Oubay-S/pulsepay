"use client";

import React, { useState, useEffect } from "react";
import { Sliders, Save, Check, Loader2, ShieldAlert } from "lucide-react";
import type { PolicyRow } from "@/types/database";

interface PolicyPanelProps {
  onSaved?: () => void;
}

export function PolicyPanel({ onSaved }: PolicyPanelProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [maxDiscount, setMaxDiscount] = useState<number>(10);
  const [maxInstallments, setMaxInstallments] = useState<number>(3);
  const [minFirstPayment, setMinFirstPayment] = useState<number>(30);
  const [approvalThreshold, setApprovalThreshold] = useState<number>(2000);

  useEffect(() => {
    async function loadPolicy() {
      try {
        setLoading(true);
        const res = await fetch("/api/policy");
        if (!res.ok) throw new Error("Failed to load business policies");
        const data = await res.json();
        const p: PolicyRow = data.policy;
        if (p) {
          setMaxDiscount(p.max_discount_pct ?? 10);
          setMaxInstallments(p.max_installments ?? 3);
          setMinFirstPayment(p.min_first_payment_pct ?? 30);
          setApprovalThreshold(p.approval_threshold ?? 2000);
        }
      } catch (err: any) {
        console.error("Policy load error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadPolicy();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      setSavedSuccess(false);

      const res = await fetch("/api/policy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          max_discount_pct: Number(maxDiscount),
          max_installments: Number(maxInstallments),
          min_first_payment_pct: Number(minFirstPayment),
          approval_threshold: Number(approvalThreshold),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update policy");
      }

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
      if (onSaved) onSaved();
    } catch (err: any) {
      setError(err.message || "Failed to save policy");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="apple-card-light p-6 flex flex-col gap-5">
      <div className="flex items-center justify-between border-b border-[var(--pp-line)] pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[var(--pp-surface-muted)] text-[var(--pp-ink)] flex items-center justify-center">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-[var(--pp-ink)] tracking-tight">
              Negotiation Guardrails & Policies
            </h3>
            <p className="text-[12px] text-[var(--pp-ink-soft)]">
              Deterministic Zod guardrails enforced before any agreement can touch PayPal.
            </p>
          </div>
        </div>

        {savedSuccess && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold bg-[var(--pp-recovered-soft)] text-[var(--pp-recovered)] border border-[var(--pp-recovered-border)]">
            <Check className="w-3.5 h-3.5" /> Guardrails Saved
          </span>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-[var(--pp-overdue-soft)] border border-[var(--pp-overdue-border)] text-[var(--pp-overdue)] text-[12.5px] flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="py-8 flex justify-center text-[var(--pp-ink-soft)]">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : (
        <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Max Discount % */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-semibold text-[var(--pp-ink-soft)] uppercase tracking-wider">
                Max Early Discount
              </label>
              <span className="text-[13px] font-bold text-[var(--pp-accent)] tnum">
                {maxDiscount}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="25"
              step="1"
              value={maxDiscount}
              onChange={(e) => setMaxDiscount(Number(e.target.value))}
              className="accent-[var(--pp-accent)] cursor-pointer h-1.5 bg-[var(--pp-line)] rounded-lg"
            />
            <span className="text-[11px] text-[var(--pp-ink-tertiary)]">
              Max concession agent can offer for 48h settlement.
            </span>
          </div>

          {/* Max Installments */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-semibold text-[var(--pp-ink-soft)] uppercase tracking-wider">
                Max Staged Parts
              </label>
              <span className="text-[13px] font-bold text-[var(--pp-accent)] tnum">
                {maxInstallments} parts
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="6"
              step="1"
              value={maxInstallments}
              onChange={(e) => setMaxInstallments(Number(e.target.value))}
              className="accent-[var(--pp-accent)] cursor-pointer h-1.5 bg-[var(--pp-line)] rounded-lg"
            />
            <span className="text-[11px] text-[var(--pp-ink-tertiary)]">
              Max number of scheduled PayPal installment invoices.
            </span>
          </div>

          {/* Min First Payment % */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-semibold text-[var(--pp-ink-soft)] uppercase tracking-wider">
                Min First Payment
              </label>
              <span className="text-[13px] font-bold text-[var(--pp-accent)] tnum">
                {minFirstPayment}%
              </span>
            </div>
            <input
              type="range"
              min="10"
              max="60"
              step="5"
              value={minFirstPayment}
              onChange={(e) => setMinFirstPayment(Number(e.target.value))}
              className="accent-[var(--pp-accent)] cursor-pointer h-1.5 bg-[var(--pp-line)] rounded-lg"
            />
            <span className="text-[11px] text-[var(--pp-ink-tertiary)]">
              Installment 1 must cover this minimum percentage.
            </span>
          </div>

          {/* Approval Threshold */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-semibold text-[var(--pp-ink-soft)] uppercase tracking-wider">
                Approval Threshold
              </label>
              <span className="text-[13px] font-bold text-[var(--pp-ink)] tnum">
                ${approvalThreshold.toLocaleString()}
              </span>
            </div>
            <input
              type="number"
              min="0"
              step="100"
              value={approvalThreshold}
              onChange={(e) => setApprovalThreshold(Number(e.target.value))}
              className="px-3 py-1.5 text-[13px] bg-[var(--pp-surface)] border border-[var(--pp-line-strong)] rounded-xl text-[var(--pp-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--pp-accent)] tnum font-semibold"
            />
            <span className="text-[11px] text-[var(--pp-ink-tertiary)]">
              Invoices above this amount always require manual sign-off.
            </span>
          </div>

          {/* Action Row */}
          <div className="sm:col-span-2 lg:col-span-4 flex items-center justify-end pt-2 border-t border-[var(--pp-line)]">
            <button
              type="submit"
              disabled={saving}
              className="apple-press inline-flex items-center gap-2 px-5 py-2 rounded-xl text-[12.5px] font-bold bg-[var(--pp-primary)] hover:bg-[var(--pp-primary-strong)] text-white shadow-sm disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Business Policies
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
