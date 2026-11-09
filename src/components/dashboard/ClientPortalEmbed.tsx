"use client";

import React, { useState, useEffect } from "react";
import {
  Send,
  Sparkles,
  CheckCircle2,
  CreditCard,
  Percent,
  Calendar,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import type { ClientPageData } from "@/types/api";

interface ClientPortalEmbedProps {
  token: string;
}

export function ClientPortalEmbed({ token }: ClientPortalEmbedProps) {
  const [data, setData] = useState<ClientPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [inputMessage, setInputMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPortalData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/c/${token}`);
      if (!res.ok) throw new Error("Could not load client portal data");
      const json: ClientPageData = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || "Failed to load portal");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPortalData();
  }, [token]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || sending) return;

    const messageText = inputMessage.trim();
    setInputMessage("");
    try {
      setSending(true);
      setError(null);
      const res = await fetch(`/api/c/${token}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: messageText }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to send message");
      }

      await loadPortalData();
    } catch (err: any) {
      setError(err.message || "Failed to deliver message");
    } finally {
      setSending(false);
    }
  };

  const handleAcceptOffer = async (arrangementId: string) => {
    try {
      setAcceptingId(arrangementId);
      setError(null);
      const res = await fetch(`/api/c/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ arrangement_id: arrangementId }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to execute offer");
      }

      setStatusBanner("Offer accepted! Registered with PayPal.");
      await loadPortalData();
    } catch (err: any) {
      setError(err.message || "Failed to accept offer");
    } finally {
      setAcceptingId(null);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-[var(--pp-ink-soft)]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--pp-accent)] mb-2" />
        <span className="text-[13px] font-medium">Connecting to Client Portal...</span>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-6 text-center text-[var(--pp-overdue)]">
        <ShieldAlert className="w-8 h-8 mx-auto mb-2" />
        <span className="text-[13px] font-semibold">{error}</span>
      </div>
    );
  }

  const invoice = data?.invoice;
  const messages = data?.messages || [];
  const offers = data?.offers || [];

  return (
    <div className="h-full flex flex-col bg-[var(--pp-bg-deep)] text-[var(--pp-ink)] overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[var(--pp-line)] bg-[var(--pp-surface)] flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-[14.5px] text-[var(--pp-ink)]">
              {data?.business_name || "Merchant"}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--pp-accent-soft)] text-[var(--pp-accent)] border border-[var(--pp-accent-border)]">
              Client Portal
            </span>
          </div>
          <p className="text-[11.5px] text-[var(--pp-ink-faint)] mt-0.5">
            Invoice #{token.replace("demo-", "").toUpperCase()}
          </p>
        </div>

        <div className="text-right">
          <span className="text-[10px] uppercase font-bold text-[var(--pp-ink-faint)] tracking-wider">
            Amount Due
          </span>
          <div className="text-[17px] font-bold text-[var(--pp-ink)] tnum">
            ${Number(invoice?.amount || 0).toLocaleString()}
          </div>
        </div>
      </div>

      {statusBanner && (
        <div className="px-4 py-2 bg-[var(--pp-recovered-soft)] border-b border-[var(--pp-recovered-border)] text-[var(--pp-recovered)] text-[12px] font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{statusBanner}</span>
        </div>
      )}

      {/* Message Thread */}
      <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3">
        {messages.length === 0 ? (
          <div className="text-center py-10 text-[var(--pp-ink-faint)] text-[12.5px]">
            No messages yet. Send a note below to discuss payment options.
          </div>
        ) : (
          messages.map((m) => {
            const isClient = m.sender === "CLIENT";
            return (
              <div
                key={m.id}
                className={`flex flex-col max-w-[85%] ${
                  isClient ? "ml-auto items-end" : "mr-auto items-start"
                }`}
              >
                <span className="text-[10.5px] font-semibold text-[var(--pp-ink-faint)] mb-1 px-1">
                  {isClient ? "You (Client)" : "PulsePay Assistant"}
                </span>
                <div
                  className={`p-3.5 text-[12.5px] leading-relaxed ${
                    isClient
                      ? "bg-[var(--pp-primary)] text-[#FCFCFC] rounded-[16px_16px_0_16px]"
                      : "bg-[var(--pp-lime-soft)] text-[var(--pp-ink)] rounded-[16px_16px_16px_0]"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            );
          })
        )}

        {/* Structured Offers */}
        {offers.length > 0 && (
          <div className="my-2 p-3.5 rounded-[10px] bg-[var(--pp-surface)] border border-[var(--pp-line)] flex flex-col gap-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--pp-accent)] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Options Available
            </span>

            {offers.map((offer) => {
              const terms: any = offer.terms || {};
              const isProposed = offer.status === "PROPOSED" || offer.status === "PENDING_APPROVAL";
              return (
                <div
                  key={offer.id}
                  className="p-3 rounded-[10px] bg-[var(--pp-surface-muted)] border border-[var(--pp-line)] flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5">
                    {offer.type === "DISCOUNT" && (
                      <div className="w-8 h-8 rounded-lg bg-[var(--pp-recovered-soft)] text-[var(--pp-recovered)] flex items-center justify-center">
                        <Percent className="w-4 h-4" />
                      </div>
                    )}
                    {offer.type === "PLAN" && (
                      <div className="w-8 h-8 rounded-lg bg-[var(--pp-due-soft)] text-[var(--pp-due)] flex items-center justify-center">
                        <Calendar className="w-4 h-4" />
                      </div>
                    )}
                    {offer.type === "PAY_LATER" && (
                      <div className="w-8 h-8 rounded-lg bg-[var(--pp-accent-soft)] text-[var(--pp-accent)] flex items-center justify-center">
                        <CreditCard className="w-4 h-4" />
                      </div>
                    )}

                    <div>
                      <div className="text-[12px] font-bold text-[var(--pp-ink)]">
                        {offer.type === "DISCOUNT" && `${terms.discount_percentage || terms.requested_discount_pct}% Early Discount`}
                        {offer.type === "PLAN" && `${terms.number_of_installments} Installments of $${terms.installment_amount}`}
                        {offer.type === "PAY_LATER" && "PayPal Pay Later"}
                      </div>
                      <div className="text-[11px] text-[var(--pp-ink-faint)]">
                        Status: <span className="font-semibold">{offer.status}</span>
                      </div>
                    </div>
                  </div>

                  {isProposed && (
                    <button
                      onClick={() => handleAcceptOffer(offer.id)}
                      disabled={acceptingId === offer.id}
                      className="apple-press px-3 py-1.5 rounded-[4px] text-[11.5px] font-bold bg-[var(--pp-primary)] hover:bg-[var(--pp-primary-strong)] text-[var(--pp-on-primary)] disabled:opacity-50"
                    >
                      {acceptingId === offer.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        "Accept Option"
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Input Composer */}
      <form onSubmit={handleSendMessage} className="p-3 border-t border-[var(--pp-line)] bg-[var(--pp-surface)] flex items-center gap-2">
        <input
          type="text"
          placeholder="Type message (e.g. 'Can I pay in 3 parts?')..."
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          disabled={sending}
          className="flex-1 px-3.5 py-2 text-[12.5px] bg-[var(--pp-surface-muted)] border border-[var(--pp-line)] rounded-[10px] text-[var(--pp-ink)] placeholder:text-[var(--pp-ink-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--pp-accent)]"
        />

        <button
          type="submit"
          disabled={sending || !inputMessage.trim()}
          className="apple-press p-2 rounded-[4px] bg-[var(--pp-primary)] hover:bg-[var(--pp-primary-strong)] text-[var(--pp-on-primary)] disabled:opacity-40"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>
    </div>
  );
}
