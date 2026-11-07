# PulsePay — Current Project Status & Team Handoff Guide
> Date: Friday, November 6, 2026 (End of Day 1)  
> Target: PayPal AI Hackathon 2026  
> Tech Lead: Oubay

---

## 1. Executive Summary

As of the end of Day 1, the foundational backend architecture, database schema, policy guardrails, automated test suite, CI/CD pipeline, and cloud deployment are **100% operational and live in production**.

- **Repository**: [https://github.com/Oubay-S/pulsepay](https://github.com/Oubay-S/pulsepay) (Public)
- **Live Production URL**: [https://pulsepay-rho.vercel.app](https://pulsepay-rho.vercel.app)
- **Database**: Supabase PostgreSQL + Realtime deployed in Frankfurt (`eu-central-1`)
- **CI Status**: GitHub Actions CI is 100% green on all branches
- **Test Suite**: 17 passing unit tests (Policy Guard, Intent Gate, Scoring)

---

## 2. Live Cloud Infrastructure Endpoints

The backend is deployed serverless on Vercel and connected directly to the live Supabase database. You can test these URLs right now in your browser or terminal:

| Service | Live URL | Description |
|---|---|---|
| **Health Check** | [https://pulsepay-rho.vercel.app/api/health](https://pulsepay-rho.vercel.app/api/health) | Database keep-alive and system status (returns `status: "ok"`) |
| **Invoices & KPIs** | [https://pulsepay-rho.vercel.app/api/invoices](https://pulsepay-rho.vercel.app/api/invoices) | Feeds the owner dashboard AG Grid with computed metrics |
| **PayPal Webhook** | `https://pulsepay-rho.vercel.app/api/paypal/webhook` | HTTPS webhook endpoint for PayPal Sandbox notifications |
| **Client Portal Demo** | [https://pulsepay-rho.vercel.app/api/c/demo-inv2-sarah-001](https://pulsepay-rho.vercel.app/api/c/demo-inv2-sarah-001) | API data for Sarah Chen's $850 invoice conversation |
| **Demo Clock** | `https://pulsepay-rho.vercel.app/api/demo/clock` | Time simulation endpoint (`GET` to check, `POST` to advance days) |
| **Approvals Queue** | `https://pulsepay-rho.vercel.app/api/approvals` | List of proposals pending owner approval or disputed work |

---

## 3. Database State (Supabase)

The live database contains the 11 tables required by the specification:
- `businesses`, `policies`, `clients`, `invoices`, `conversations`, `messages`, `arrangements`, `installments`, `events`, `processed_events`, `demo_clock`.
- **Supabase Realtime** is active on `invoices`, `arrangements`, `installments`, `messages`, and `events`.
- **Pre-seeded Hackathon Scenarios**:
  1. **Sarah Chen** (`INV2-SARAH-001`): $850, 7 days overdue, 90% on-time client history (Priority Score: 35). Token: `demo-inv2-sarah-001`.
  2. **Marcus Rivera** (`INV2-MARCUS-002`): $1,200, 15 days overdue, 60% on-time client history (Priority Score: 48). Token: `demo-inv2-marcus-002`.
  3. **Alex Thompson** (`INV2-ALEX-003`): $3,500, 30 days overdue, 40% on-time client history (Priority Score: 80). Token: `demo-inv2-alex-003`.

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

# Run all 17 backend unit tests
npm test

# Verify live Supabase database connectivity & demo data
npm run test:api

# Re-seed demo database with the 3 hackathon scenarios
npm run seed

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
- `npm test`: 32/32 passing (policy guard, intent gate, scoring, portal normalization, approvals, email templates).
- `npx tsc --noEmit` and `npm run build`: clean.
- Browser checks: new conversation, plan offers, accepted plan, pending owner review, dispute, paid invoice, invalid token, approvals counter, approvals reject; desktop, mobile, and dark mode.

### Open integration points
- **Omar / Oubay**: PayPal Sandbox app credentials are now in `.env`; `NEXT_PUBLIC_PAYPAL_CLIENT_ID` mirrors `PAYPAL_CLIENT_ID` for the browser SDK. The client page consumes the payable payer link and renders the official PayPal JS SDK in the Pay Later card.
- **Taha**: the client portal now has a real pay CTA and a compact invoice journey; reuse `src/app/pulsepay-theme.css` tokens for the dashboard if helpful.
- **Taha**: link the dashboard to `/approvals` and add the client-page token to the split view (the approvals cards already open the client page).
- **Oubay**: service-role key for every teammate's local `.env.local`, and review of the additive API changes above.
