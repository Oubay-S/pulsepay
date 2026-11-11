# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Freelancers and small businesses who invoice clients through PayPal and have invoices going overdue. They want to get paid without spending hours chasing clients or damaging the relationship. Secondary: their clients, who receive a private payment page and talk to the assistant there.

## Product Purpose

PulsePay recovers overdue PayPal invoices. It scores which invoices need attention, sends polite follow-ups, and negotiates with the client on a private page: an early-payment discount, an installment plan, or PayPal Pay Later. Success means the owner gets paid, the client keeps their dignity, and nothing happens outside the owner's rules.

## Positioning

The AI negotiates, but it never moves money. Every offer passes a deterministic policy guard (max discount, max installments, minimum first payment, approval threshold). Anything outside the rules goes to the owner's approval queue. Only backend code executes agreements through real PayPal APIs.

## Operating Context

- Owner works in the dashboard (`/dashboard`): receivables KPIs, invoice aging table with explainable priority scores, approvals queue, policy controls, audit log.
- Client works on a private link (`/c/[token]`): invoice summary, conversation with the billing assistant, structured offer cards, PayPal checkout.
- Owner approvals and disputes also at `/approvals`.
- Runs on PayPal Sandbox with real API calls: Invoicing v2, Orders v2, Pay Later (JS SDK), verified webhooks.

## Capabilities and Constraints

- Offer types: early-payment discount (void + reissue), installment plan (installment 1 sent now, rest scheduled), Pay Later (merchant paid in full upfront).
- Intent gate catches disputes and prompt-injection before the LLM; disputes pause automation.
- Copy must present PulsePay as a product. Do not use the word "demo" on product-facing pages.

## Brand Commitments

- Name: PulsePay. Built for the PayPal AI Hackathon 2026.
- Voice: calm, polite, never a debt collector.
- PayPal blue stays on PayPal-branded payment buttons.

## Evidence on Hand

No metrics, testimonials, customer logos, or press. Do not fabricate any. Proof is the product itself: real screens, the real flow, the safety rules, the PayPal APIs used.

## Product Principles

1. Get the owner paid without hurting the client relationship.
2. The AI proposes; rules and people decide; code executes.
3. Every decision is explainable (priority scores, policy reasons, audit log).
4. Offer the client a way to pay, not a threat.
