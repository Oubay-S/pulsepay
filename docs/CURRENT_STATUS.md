# PulsePay — Current Project Status & Team Handoff Guide
> Date: Wednesday, November 11, 2026
> Target: PayPal AI Hackathon 2026
> Tech Lead: Oubay

---

## 1. Executive Summary

PulsePay is deployed and running real PayPal Sandbox flows end to end: invoice → agent negotiation → PayPal → verified webhook → dashboard.

- **Repository**: [https://github.com/Oubay-S/pulsepay](https://github.com/Oubay-S/pulsepay) (Public)
- **Live Production URL**: [https://pulsepay-rho.vercel.app](https://pulsepay-rho.vercel.app)
- **Database**: Supabase PostgreSQL + Realtime deployed in Frankfurt (`eu-central-1`)
- **CI Status**: GitHub Actions CI is green on `main`
- **Test Suite**: 37 passing unit tests (Policy Guard, Intent Gate, Scoring, portal normalization, approvals, email)
- **PayPal**: Sandbox only — real invoices, discounts, installment plans, Pay Later, and signed webhooks. No mocks.

---

## 2. Live Cloud Infrastructure Endpoints

The backend is deployed serverless on Vercel and connected directly to the live Supabase database. You can test these URLs right now in your browser or terminal:

| Service | Live URL | Description |
|---|---|---|
| **Health Check** | [https://pulsepay-rho.vercel.app/api/health](https://pulsepay-rho.vercel.app/api/health) | Database keep-alive and system status (returns `status: "ok"`) |
| **Invoices & KPIs** | [https://pulsepay-rho.vercel.app/api/invoices](https://pulsepay-rho.vercel.app/api/invoices) | Feeds the owner dashboard AG Grid with computed metrics |
| **PayPal Webhook** | `https://pulsepay-rho.vercel.app/api/paypal/webhook` | HTTPS webhook endpoint for PayPal Sandbox notifications |
| **Client Portal Demo** | [https://pulsepay-rho.vercel.app/c/demo-inv2-elena-001](https://pulsepay-rho.vercel.app/c/demo-inv2-elena-001) | Elena Rostova's $850 invoice conversation (client page) |
| **Demo Clock** | `https://pulsepay-rho.vercel.app/api/demo/clock` | Time simulation endpoint (`GET` to check, `POST` to advance days) |
| **Approvals Queue** | `https://pulsepay-rho.vercel.app/api/approvals` | List of proposals pending owner approval or disputed work |

---

## 3. Database State (Supabase)

The live database contains the 11 tables required by the specification:
- `businesses`, `policies`, `clients`, `invoices`, `conversations`, `messages`, `arrangements`, `installments`, `events`, `processed_events`, `demo_clock`.
- **Supabase Realtime** is active on `invoices`, `arrangements`, `installments`, `messages`, and `events`.
- **Seeded demo business**: **Studio Chen Creative LLC** — 8 clients, 8 real PayPal Sandbox invoices (no fake IDs):
  1. **Elena Rostova** — $850, 7 days overdue. Token: `demo-inv2-elena-001`.
  2. **Marcus Reed** — $1,200, 18 days overdue. Token: `demo-inv2-marcus-002`.
  3. **Julian Hayes** — $3,500, 35 days overdue, has a **pending owner approval**. Token: `demo-inv2-alex-003`.
  4. **Dr. Aris Thorne** — $2,800, 48 days overdue, partly paid. Token: `demo-inv2-kroma-004`.
  5. **Nadia Benali** — $650, 12 days overdue. Token: `demo-inv2-atlas-005`.
  6. **Lucas Moreau** — $1,750, 68 days overdue. Token: `demo-inv2-solstice-006`.
  7. **Chloe Dupont** — $920, paid. Token: `demo-inv2-lumiere-007`.
  8. **Tariq Al-Mansoor** — $2,400, 3-installment plan in progress. Token: `demo-inv2-oasis-008`.

The old tokens `demo-inv2-sarah-001` and `demo-inv2-julian-003` are kept as aliases so existing links still resolve.

### Shared Team Credentials for Local Development
Copy these into your local `.env.local` file:
```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://lcdbsizmkvsbmtuifwoq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjZGJzaXpta3ZzYm10dWlmd29xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5OTYxODQsImV4cCI6MjEwOTU3MjE4NH0.phdvfpNpGN7tlakEJ2DY9KqVAel9zNh75XfSestCGZM
PAYPAL_ENVIRONMENT=sandbox
```
*(Ask Oubay for the `SUPABASE_SERVICE_ROLE_KEY` if your backend route requires privileged database access).*

---

## 4. Teammate Work Allocations & Day 2 (Saturday) Checklist

To prevent merge conflicts, each team member has an exclusive branch and set of files.

### Taha — Frontend Architecture & Dashboard UI
- **Branch**: `feat/taha-dashboard-ui`
- **Files Owned**: `src/app/page.tsx`, `src/app/layout.tsx`, dashboard components.
- **Goals for Day 2**:
  - Replace the default Next.js starter page in `src/app/page.tsx` with the Owner Dashboard.
  - Integrate **AG Grid Community** (Quartz theme) to display the overdue invoice aging table.
  - Connect the KPI Strip to `GET /api/invoices` (`total_outstanding`, `total_overdue`, `recovered_this_month`, `needs_approval`).
  - Add green cell flashing on rows when payments update via Supabase Realtime.
  - Add controls for the Demo Clock ("+1 Day", "+7 Days", "Reset Demo").

### Soulaimane — Client Experience & Messaging Portal
- **Branch**: `feat/soulaimane-client-portal`
- **Files Owned**: `src/app/c/[token]/page.tsx`, offer card components, chat thread.
- **Goals for Day 2**:
  - Build the mobile-friendly Client Portal in `src/app/c/[token]/page.tsx`.
  - Fetch conversation data and active proposals from `GET /api/c/[token]`.
  - Display the bilateral chat thread (Agent in purple, Client in grey, Owner in blue).
  - Render offer cards (Early Payment Discount, 3x Installment Plan, Pay Later).
  - Connect the "Accept Offer" button to `POST /api/c/[token]/accept`.

### Omar — PayPal Integration & Agent Toolkit
- **Branch**: `feat/omar-paypal-toolkit`
- **Files Owned**: `src/lib/paypal/toolkit.ts`, `src/lib/paypal/executor.ts`, `src/lib/paypal/webhooks.ts`.
- **Goals for Day 2**:
  - Configure PayPal Sandbox credentials in `.env.local` (`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`).
  - Configure the PayPal Webhook URL in PayPal Developer Dashboard:
    `https://pulsepay-rho.vercel.app/api/paypal/webhook`
  - Verify webhook event types: `INVOICING.INVOICE.PAID`, `PAYMENT.CAPTURE.COMPLETED`.
  - Connect `createPayPalInvoice` and `sendPayPalInvoice` in `src/lib/paypal/toolkit.ts` to real PayPal Sandbox endpoints.

### Reda — AI Agent Engineering & Intent Gate
- **Branch**: `feat/reda-agent-prompts`
- **Files Owned**: `src/lib/agent/intent-gate.ts`, `src/lib/agent/tools.ts`, `src/lib/llm.ts`.
- **Goals for Day 2**:
  - Refine system prompts in `src/lib/llm.ts` to reflect the merchant's chosen tone (polite, respectful, helpful).
  - Enhance `detectIntent` in `src/lib/agent/intent-gate.ts` to catch adversarial prompt injections and client work disputes.
  - Expand test cases in `src/lib/agent/__tests__/intent-gate.test.ts`.

### Mohamed — Data Engineering, Scoring & QA
- **Branch**: `feat/mohamed-scoring-data`
- **Files Owned**: `src/lib/scoring.ts`, `src/lib/__tests__/scoring.test.ts`, `scripts/seed.ts`.
- **Goals for Day 2**:
  - Review and fine-tune the priority scoring weights in `src/lib/scoring.ts`.
  - Add additional realistic sample clients and invoices to `src/lib/seed.ts` if needed.
  - Run end-to-end integration verification every evening at 21:00.

### Oubay — Tech Lead & Backend
- **Branch**: `main`
- **Responsibilities**:
  - Code review and merging of all Pull Requests from team branches.
  - Ensuring the automated CI suite passes before merging.
  - Maintaining database health, Vercel deployments, and overall architectural integrity.

---

## 5. Developer Commands Reference

Run these commands from the `pulsepay` folder:

```bash
# Start local development server
npm run dev

# Run all 37 backend unit tests
npm test

# Verify live Supabase database connectivity & demo data
npm run test:api

# Re-seed the demo with 8 real PayPal Sandbox invoices
npm run seed

# Run the real PayPal Sandbox verification suites
npm run verify:phase1
npm run verify:webhook
npm run verify:sync
npm run verify:block-c
npm run verify:paylater

# Run full production build verification (mandatory before submitting PR)
npm run build
```

---

## 6. Pull Request Rules

1. Always branch off the latest `main`: `git checkout main && git pull origin main`.
2. Work only on your assigned feature branch.
3. Verify `npm test` and `npm run build` pass with zero errors before opening a PR.
4. Fill out the PR checklist in `.github/pull_request_template.md`.
5. Oubay reviews and merges to `main`. Once merged, Vercel updates the production URL automatically.

---

## 7. Day 2 Update — Client Portal & Approvals (Soulaimane)

### New screens
- **Client portal**: `src/app/c/[token]/page.tsx`
  - Server-rendered first paint, then 6-second polling.
  - Real **Pay in PayPal** CTA from the merged `payable.payer_link` (works for invoices and plan installments).
  - Agent / client / owner conversation bubbles, quick replies, optimistic sending, typing state.
  - Offer rows for early-payment discounts, installment plans, and the official PayPal JS SDK Pay Later checkout.
  - Pending-owner, disputed, paid, and invalid-link states.
  - Mobile-first, dark mode, reduced-motion support.
- **Owner approvals**: `src/app/approvals/page.tsx`
  - Summary strip, dispute banners, client links.
  - Approve, reject with a reason, and counter with a discount or an installment plan.
  - Counter-offers are validated before they become client-facing proposals.
- **Shared visual system**: `src/app/pulsepay-theme.css`
  - White-first PayPal-inspired surface: pure white canvas, white cards, near-black primary actions, and PayPal blue reserved for links, status accents, focus, and the official PayPal button.
  - Light-only by design: `color-scheme: light` and explicit white surfaces keep the canvas white even when the OS prefers dark mode.
  - Shared by the client portal and approvals so the two sides feel like one product.

### New libraries
- `src/lib/client-portal/` — safe token-payload normalization, offer view models, formatting.
- `src/lib/approvals/` — shared approvals query, request parsing, counter-plan builder.
- `src/lib/email.ts` — Resend follow-up email with HTML + text versions. Email is optional; the client page works without it.

### Additive API changes
- `GET /api/c/[token]` now returns `client_name`, `business_tone`, `demo_now`, `payable`, and `paylater`, with `Cache-Control: no-store`.
- `GET /api/invoices` now includes conversation tokens so the owner dashboard can open the client page directly.
- `GET /api/approvals` now returns `policy`, `demo_now`, and the conversation token for client links.
- `POST /api/approvals/:id` validates approve/counter terms and resumes a disputed conversation after an owner counter.
- `POST /api/c/[token]/accept` now verifies that the arrangement belongs to the token's invoice and only allows `ACTIVE` conversations.
- `POST /api/c/[token]/message` rejects messages while a conversation is paused.
- `POST /api/invoices/:id/follow-up` now attaches the Resend email result; email failure never blocks the follow-up.

### Verification completed
- `npm test`: 37/37 passing (policy guard, intent gate, scoring, portal normalization, approvals, email templates).
- `npx tsc --noEmit` and `npm run build`: clean.
- Browser checks: new conversation, plan offers, accepted plan, pending owner review, dispute, paid invoice, invalid token, approvals counter, approvals reject; desktop, mobile, and dark mode.

### Open integration points
- **Omar / Oubay**: PayPal Sandbox app credentials are now in `.env`; `NEXT_PUBLIC_PAYPAL_CLIENT_ID` mirrors `PAYPAL_CLIENT_ID` for the browser SDK. The client page consumes the payable payer link and renders the official PayPal JS SDK in the Pay Later card.
- **Taha**: the client portal now has a real pay CTA and a compact invoice journey; reuse `src/app/pulsepay-theme.css` tokens for the dashboard if helpful.
- **Taha**: link the dashboard to `/approvals` and add the client-page token to the split view (the approvals cards already open the client page).
- **Oubay**: service-role key for every teammate's local `.env.local`, and review of the additive API changes above.
