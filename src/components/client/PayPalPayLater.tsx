'use client';

import { useEffect, useRef, useState } from 'react';

interface PayPalButtonInstance {
  render: (target: HTMLElement) => void;
  close?: () => void;
}

interface PayPalNamespace {
  Buttons: (options: Record<string, unknown>) => PayPalButtonInstance;
}

declare global {
  interface Window {
    paypal?: PayPalNamespace;
  }
}

interface PayPalPayLaterProps {
  createUrl: string;
  captureUrl: string;
  currency: string;
  onCaptured: () => void;
}

type ConsentStatus = 'loading' | 'ready' | 'error' | 'unavailable';

function isPlaceholder(value: string | undefined): boolean {
  const normalized = (value || '').trim().toLowerCase();
  return !normalized || normalized.startsWith('your') || normalized.startsWith('placeholder');
}

export default function PayPalPayLater({
  createUrl,
  captureUrl,
  currency,
  onCaptured,
}: PayPalPayLaterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<ConsentStatus>('loading');
  const [message, setMessage] = useState<string | null>(null);
  const envClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const clientId =
    envClientId && !isPlaceholder(envClientId) ? envClientId : null;

  useEffect(() => {
    if (!clientId) return;

    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let frame = 0;
    const scriptId = 'paypal-sdk-js';

    const renderButtons = () => {
      if (cancelled) return;

      // The same card is rendered in the desktop side column and the mobile
      // inline panel. Only the visible copy should mount a PayPal button.
      if (!container.offsetParent) {
        setStatus('unavailable');
        return;
      }

      const paypal = window.paypal;
      if (!paypal?.Buttons) {
        setStatus('error');
        return;
      }

      container.innerHTML = '';

      try {
        paypal
          .Buttons({
            style: {
              layout: 'vertical',
              color: 'blue',
              shape: 'pill',
              label: 'paypal',
              height: 48,
              tagline: false,
            },
            createOrder: async () => {
              setMessage(null);
              const response = await fetch(createUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
              });
              const payload = await response.json().catch(() => ({}));

              if (!response.ok || typeof payload.id !== 'string') {
                throw new Error(
                  typeof payload.error === 'string'
                    ? payload.error
                    : 'PayPal checkout could not be started.'
                );
              }

              return payload.id;
            },
            onApprove: async (data: { orderID?: string }) => {
              if (!data.orderID) {
                setMessage('PayPal did not return an order ID.');
                return;
              }

              const response = await fetch(captureUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: data.orderID }),
              });
              const payload = await response.json().catch(() => ({}));

              if (!response.ok) {
                setMessage(
                  typeof payload.error === 'string'
                    ? payload.error
                    : 'PayPal could not complete this payment.'
                );
                return;
              }

              setMessage('Payment received. Updating your invoice…');
              onCaptured();
            },
            onCancel: () => setMessage('Payment was cancelled. You can try again.'),
            onError: () =>
              setMessage('PayPal checkout could not be completed. Please try again.'),
          })
          .render(container);

        setStatus('ready');
      } catch {
        setStatus('error');
      }
    };

    // Defer one frame so display:none panels have settled before we decide
    // which copy of the Pay Later card should own the PayPal button.
    frame = window.requestAnimationFrame(() => {
      const existing = document.getElementById(scriptId) as HTMLScriptElement | null;

      if (existing) {
        if (window.paypal) renderButtons();
        else existing.addEventListener('load', renderButtons, { once: true });
        return;
      }

      const script = document.createElement('script');
      script.id = scriptId;
      script.async = true;
      script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(
        clientId
      )}&components=buttons&enable-funding=paylater&disable-funding=card,credit&currency=${encodeURIComponent(
        currency
      )}&intent=capture`;
      script.onload = renderButtons;
      script.onerror = () => setStatus('error');
      document.body.appendChild(script);
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [captureUrl, clientId, createUrl, currency, onCaptured]);

  if (!clientId || status === 'unavailable') return null;

  return (
    <div className="pp-paylater">
      <div ref={containerRef} className="pp-paylater__buttons" />
      {status === 'loading' ? (
        <p className="pp-paylater__status">Loading PayPal checkout…</p>
      ) : null}
      {status === 'error' ? (
        <p className="pp-paylater__status">
          PayPal checkout could not load. You can still pay the invoice above.
        </p>
      ) : null}
      {message ? (
        <p className="pp-paylater__message" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
