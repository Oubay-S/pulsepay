"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface LiveToastProps {
  onPaymentReceived?: () => void;
}

export function LiveToast({ onPaymentReceived }: LiveToastProps) {
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      const supabase = createClient();
      const channel = supabase
        .channel("pulsepay-live-payment-toasts")
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "invoices" },
          (payload: any) => {
            if (payload.new && payload.new.status === "PAID" && payload.old?.status !== "PAID") {
              const amount = Number(payload.new.amount).toLocaleString();
              setToastMessage(`Payment Settled: Invoice #${payload.new.paypal_invoice_id} ($${amount}) cleared in PayPal!`);
              if (onPaymentReceived) onPaymentReceived();
              setTimeout(() => setToastMessage(null), 6000);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (e) {
      console.warn("Realtime toast listener error:", e);
    }
  }, [onPaymentReceived]);

  if (!toastMessage) return null;

  return (
    <div role="status" aria-live="polite" className="pp-toast fixed bottom-6 right-6 z-50 max-w-md">
      <div className="p-4 rounded-[10px] bg-[var(--pp-primary)] text-[#FCFCFC] flex items-center gap-3 shadow-[var(--pp-shadow-lg)]">
        <div className="w-9 h-9 rounded-[4px] bg-[var(--pp-lime)] text-[var(--pp-primary)] flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <div className="flex-1 text-[13px] font-medium leading-snug">
          {toastMessage}
        </div>
        <button
          onClick={() => setToastMessage(null)}
          aria-label="Dismiss"
          className="apple-press p-1 rounded-[4px] text-[#FCFCFC]/70 hover:text-[#FCFCFC]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

