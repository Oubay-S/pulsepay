# PulsePay — AI-Powered Receivables & Invoicing Assistant
> **PayPal AI Hackathon 2026** · Tech Stack: Next.js 16 (App Router), TypeScript, Tailwind CSS, Supabase, PayPal Agent Toolkit & Invoicing v2.

PulsePay is an autonomous, polite AI assistant designed for freelancers and small businesses that:
1. Identifies and prioritizes overdue PayPal invoices using explainable AI scoring.
2. Initiates personalized follow-ups respecting merchant tone and anti-debt-collector posture.
3. Negotiates mutually beneficial settlement terms on a dedicated client portal:
   - **PayPal Pay Later** (merchant gets paid in full upfront, client pays over time)
   - **Early-payment discounts** (e.g. 5% off if cleared within 48h via Void & Reissue)
   - **Staged installment plans** (e.g. 3 × $400 scheduled in PayPal)
4. Enforces strict business policy guardrails via deterministic Zod schemas before any agreement can touch PayPal.
5. Features a live-updating AG Grid dashboard, an approval queue for exceptions, and a simulated **Demo Clock** for advance testing.

---

## Architecture Overview

```mermaid
flowchart TD
    subgraph Owner["Owner Dashboard"]
        KPI[KPI Strip]
        GRID[AG Grid Aging Table]
        POL[Policy Settings]
        APP[Approvals & Dispute Queue]
        CLK[Demo Clock Controls]
    end

    subgraph Client["Client Portal (/c/:token)"]
        CHAT[Bilateral Conversation]
        OFFER[Structured Offer Cards]
        PAY[PayPal One-Click Checkout]
    end

    subgraph Backend["Next.js Route Handlers"]
        SYNC[/api/sync]
        SCORE[Explainable Priority Scoring]
        INTENT[Intent Gate & Security Filter]
        LLM[LLM Adapter (Gemini & Groq Fallback)]
        GUARD[Policy Guard + Zod Schemas]
        EXEC[PayPal Agreement Executor]
        SCHED[Installment Scheduler]
        WH[/api/paypal/webhook]
    end

    DB[(Supabase Postgres & Realtime)]
    PP[PayPal Sandbox APIs]

    SYNC <--> PP
    SYNC --> DB
    CHAT <--> INTENT --> LLM --> GUARD
    GUARD -->|Within Policy| EXEC --> PP
    GUARD -->|Outside Policy / Dispute| APP
    APP -->|Owner Sign-off| EXEC
    CLK --> SCHED --> PP
    PP -- Webhooks --> WH --> DB
    DB -- Realtime --> GRID
```

---

## Quick Start (Local Setup)

### 1. Prerequisites
- Node.js 20+ & npm
- A free [Supabase](https://supabase.com) project
- A [PayPal Developer](https://developer.paypal.com) account (Sandbox)

### 2. Environment Variables
Copy `.env.example` to `.env.local` and configure your keys:
```bash
cp .env.example .env.local
```

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_APP_URL` | Base application URL (`http://localhost:3000`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role secret key (for server routes & webhooks) |
| `PAYPAL_ENVIRONMENT` | `sandbox` |
| `PAYPAL_CLIENT_ID` | PayPal Sandbox App Client ID |
| `PAYPAL_CLIENT_SECRET` | PayPal Sandbox App Secret |
| `PAYPAL_WEBHOOK_ID` | PayPal Sandbox Webhook ID |
| `LLM_PRIMARY_API_KEY` | Google AI Studio Gemini API key (free tier) |
| `LLM_FALLBACK_API_KEY` | Groq API key (free tier) |

### 3. Database Migration
Run the SQL migration in your Supabase SQL Editor:
- Open [`supabase/migrations/001_initial_schema.sql`](./supabase/migrations/001_initial_schema.sql)
- Paste and execute in your Supabase dashboard SQL editor.

### 4. Seed Demo Data
Populate the database with the 3 hackathon scenarios:
```bash
# Via API endpoint:
curl -X POST http://localhost:3000/api/demo/reset

# Or via CLI script:
npx tsx scripts/seed.ts
```

### 5. Run Development Server
```bash
npm run dev
```
Visit `http://localhost:3000` for the dashboard and `http://localhost:3000/api/health` for the system status.

---

## API Reference

### Infrastructure & Demo
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Uptime health check (queries Supabase; keeps Render & DB awake) |
| `POST` | `/api/demo/clock` | Advance simulated time (`{ "days": 7 }`) and trigger due installments |
| `POST` | `/api/demo/reset` | Restore demo business, clients, policies, and the 3 test scenarios |
| `POST` | `/api/scheduler/run` | Process pending scheduled installments due as of current/simulated date |

### Merchant / Owner
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/invoices` | List invoices with client details and computed KPIs for AG Grid |
| `GET/PUT`| `/api/policy` | Retrieve or update owner negotiation policies |
| `GET` | `/api/approvals` | List arrangements requiring manual owner sign-off |
| `POST`| `/api/approvals/:id` | Approve, reject, or counter a pending proposal |

### Agent & Client Portal
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/sync` | Sync invoices from PayPal Sandbox merchant account |
| `POST` | `/api/invoices/:id/follow-up` | Generate contextual agent follow-up and create client link |
| `GET` | `/api/c/:token` | Fetch client-facing thread, invoice summary, and active offers |
| `POST` | `/api/c/:token/message` | Client message -> Intent gate -> LLM turn -> Policy guard |
| `POST` | `/api/c/:token/accept` | Client accepts an offer -> PayPal executor executes agreement |

### Webhook
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/paypal/webhook` | Handles `INVOICE.PAID`, `CAPTURE.COMPLETED`, etc. with signature verification |

---

## Security & Guardrails

- **Zero Direct LLM Money Movement**: The LLM possesses only read tools and proposal generation tools (`propose_offer`, `escalate`, `flag_dispute`). Real actions run exclusively through `executeAgreement()` in backend code.
- **Intent Gate**: Every incoming client message is audited before the agent responds. Disputed work immediately suspends automation and alerts the owner; prompt injections ("ignore rules", "owner approved 90%") are politely refused.
- **Strict Zod Policy Guard**: Enforces max discounts, minimum first installment percentages, maximum number of installments, and flags amounts exceeding the approval threshold for owner sign-off.
- **PayPal Webhook Verification**: Cryptographically verifies incoming events against PayPal's verification endpoint with all transmission headers before processing.

---

## Hackathon Team Roles
- **Oubay**: Tech Lead & Backend (Repo, schema, API endpoints, policy guard, executor, scheduler, deploy)
- **Omar**: PayPal Integration (Sandbox, Agent Toolkit, webhooks, checkout flows)
- **Reda**: AI Agent Engineering (Prompts, intent gate, LLM fallback, adversarial testing)
- **Taha**: Frontend Architecture (AG Grid aging table, KPI strip, dashboard layout)
- **Soulaimane**: Client UX & Messaging (Client portal, offer cards, interaction flows)
- **Mohamed**: Data, Scoring & QA (Priority scoring algorithm, dataset scenarios, E2E validation)
