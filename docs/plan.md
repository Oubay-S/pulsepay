# PulsePay — Final Project Plan

**PayPal AI Hackathon 2026** · Deadline: **Thu Nov 12, 12:00 PT = 20:00 Morocco** (we submit by 14:00)
**Build window:** Fri Nov 6 → Thu Nov 12 (6 days)
**Team:** Reda, Omar, Taha, Oubay, Soulaimane, Mohamed

> **One line:** An AI assistant for freelancers and small businesses that follows up on overdue PayPal invoices, understands why a client is late, and offers PayPal Pay Later, an early-payment discount or an installment plan within the owner's rules. It then sets the agreement up in PayPal so the client can pay in one click.

---

## 0. What changed after the team audit

| Audit point | Decision |
|---|---|
| Use PayPal's Agent Toolkit / MCP | **Accepted.** The Agent Toolkit has invoice tools (create, send, remind, cancel, record payment, conditional rules). We use it as our PayPal layer. The LLM only gets low-risk tools; money-changing tools run behind the policy guard. |
| Void & reissue pattern | **Accepted** as the fallback. First choice for discounts is now PayPal's native early-payment discount rule (`create_conditional_rules_for_invoice`). |
| Staged installments (no email storm) | **Accepted.** Installment 1 sent now; later ones sent by the scheduler on their dates. |
| PayPal Pay Later | **Accepted as a "should have", with honesty.** Pay Later is shown by PayPal at checkout only where available and if the client is eligible. The agent presents it as "if PayPal offers it to you". Verify in Sandbox on day 1. |
| Prompt-injection defense + dispute detection | **Accepted.** Structured tool proposals validated with Zod; policy guard in code; dispute and injection detection stop the agent. |
| AG Grid features | **Accepted, with a licensing check.** Row grouping and sparklines are AG Grid Enterprise features. Check today whether the hackathon gives an Enterprise/AG Studio trial key; otherwise use Community features (cell flashing, custom renderers, CSV export, filters). |
| Webhook verification | **Corrected.** Verify with PayPal's verify-webhook-signature endpoint using all transmission headers, not only the transmission ID. |
| Statistics in the pitch ("82%", "$100B", "#1 killer") | **Removed.** No unsourced numbers. Add a stat only if we find a real source. |
| Named judges | **Removed** from the plan. Check the official judges list on Devpost before referencing anyone. |
| Model names (Gemini 1.5 Flash, Claude 3.5 Haiku) | **Updated.** We use free AI models only (see section 2, "Zero-cost setup"), with fallback between two providers and cached demo replies. |
| Render paid instance + cron | **Dropped.** The app is hosted on Vercel's free Hobby plan; no cron job (the demo clock covers time-based features). |

---

## 1. The idea

### The problem
Freelancers and small businesses send invoices through PayPal every day, and many get paid late:
- Reminder emails are generic and get ignored.
- Owners avoid following up because they don't want to sound like debt collectors.
- A client who can't pay the full amount often goes silent, even if they would pay in parts.

### The solution
1. **Personal follow-up.** When an invoice is overdue, the agent writes a message based on the invoice, the client's history and the owner's chosen tone.
2. **Client page.** The client opens a link and replies in plain words: "I can't pay $1,200 this month."
3. **Options within the owner's rules:**
   - **PayPal Pay Later**, if PayPal offers it to the client: the client pays over time, and the owner is paid in full upfront.
   - **Early-payment discount**: e.g. 5% off if paid within 48 hours.
   - **Installment plan**: e.g. 3 × $400.
4. **Set up in PayPal.** The agreement becomes a PayPal discount rule, a reissued invoice, or installment invoices.
5. **Owner approval.** Anything outside the rules, or any dispute about the work, goes to the owner.
6. **Live dashboard.** When the client pays, the owner's dashboard updates instantly.

### Who uses it
- **Owner:** freelancer, agency, consultant, tutor or small business invoicing with PayPal (US, UK, Europe and other PayPal markets).
- **Client:** whoever received the invoice; no account needed beyond paying through PayPal.

### Positioning
The business's **own polite assistant for its own invoices**, not a debt collector. The owner sets the rules and approves exceptions. Helpful tone, never threatening.

### Scope

**Must have**
- Connect a PayPal Sandbox business account; sync invoices
- Overdue detection + explainable priority score
- Owner policy: max discount, max installments, minimum first payment, approval threshold, tone
- Follow-up message + client page conversation
- Agent with structured tool proposals + policy guard in code
- Early-payment discount (native rule, or void & reissue fallback)
- Installment plan with staged invoices
- Approval queue + dispute detection
- Webhook → dashboard updates live
- Demo clock (simulate days passing)

**Should have**
- Pay Later option on the client page (Sandbox-verified)
- Real email delivery (Resend) with link to the client page
- Audit log of every agent and PayPal action

**Nice to have**
- Weekly owner summary
- CSV export of the aging report

**Out of scope**
- Real money, accounting integrations, SMS, legal collection workflows.

---

## 2. Architecture

```mermaid
flowchart TD
    subgraph Owner["Owner dashboard (Next.js)"]
        KPI[KPI strip]
        GRID[AG Grid aging table]
        POL[Policy settings]
        APP[Approvals + disputes]
        CLK[Demo clock]
    end

    subgraph Client["Client page /c/:token"]
        CHAT[Conversation]
        OFFER[Offer cards]
        PAY[Pay button]
    end

    subgraph Backend["Backend (Next.js API routes)"]
        SYNC[Invoice sync]
        SCORE[Priority scoring]
        AGENT[Agent: LLM + read-only tools]
        GUARD[Policy guard<br/>Zod + rules + dispute gate]
        EXEC[Executor<br/>PayPal Agent Toolkit]
        SCHED[Installment scheduler]
        WH[Webhook handler]
    end

    DB[(Supabase<br/>Postgres + Realtime)]

    PPI[PayPal APIs<br/>Invoicing v2, Orders v2, Webhooks]
    LLM[Small LLM]
    EM[Resend email]

    SYNC <--> PPI
    SYNC --> DB
    SCORE --> DB
    CHAT <--> AGENT
    AGENT <--> LLM
    AGENT -->|proposal JSON| GUARD
    GUARD -->|within policy| EXEC
    GUARD -->|outside policy / dispute| APP
    APP -->|owner approves| EXEC
    EXEC --> PPI
    CLK --> SCHED --> EXEC
    PAY --> PPI
    PPI -- webhooks --> WH --> DB
    DB -- realtime --> GRID
    AGENT -.-> EM
```

### Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend + backend | **Next.js (App Router) + TypeScript + Tailwind** | One app, one deploy |
| Tables | **AG Grid** (Quartz theme) | Aging table, live updates; AG Grid sponsor prize |
| Data + realtime | **Supabase** (Postgres + Realtime) | Live dashboard without polling; free tier |
| PayPal layer | **PayPal Agent Toolkit (TypeScript)** over Invoicing v2 + Orders v2, plus raw REST where needed | Official agent tooling; strong signal for the PayPal + AI prizes |
| AI | **Free AI models** with tool calling: primary + fallback provider (e.g. Gemini API free tier via Google AI Studio, Groq free tier, OpenRouter free models) | Zero cost; pick the pair that passes our agent tests |
| Validation | **Zod** | Every LLM proposal is schema-checked before the guard |
| Email | **Resend** (free tier) | Follow-ups with link to the client page |
| Hosting | **Vercel Hobby (free)** | Zero cost, serverless, deploys on every merge to `main`; Vercel sponsor prize |

### Zero-cost setup

Everything in this plan runs on free tiers. Nobody pays anything.

| Service | Free option | How we stay within it |
|---|---|---|
| PayPal | Sandbox + developer account + Agent Toolkit | Free by design |
| Hosting | Vercel Hobby (free) | Serverless functions scale to zero; no always-on instance to pay for |
| Database + realtime | Supabase free plan | The pinger's health check queries the database, so the project never counts as idle and isn't paused |
| AI | Free models from two providers | See "AI on free models" below |
| Tables | AG Grid Community (MIT) | Enterprise features only if the hackathon provides a key |
| Email | Resend free tier | Low volume; client page works without email |
| Scheduler | Demo clock (built in) | Optional real timer: cron-job.org or scheduled GitHub Action, both free |
| Repo, video | GitHub, YouTube, OBS, DaVinci Resolve or CapCut | Free |

**Health check + pinger**
- Route `/api/health` runs a tiny Supabase query (`select 1 from businesses limit 1`) and returns `200 OK`.
- UptimeRobot (or cron-job.org) calls it every 10 minutes, from today until Dec 15.
- Normal demo traffic keeps Supabase active; Vercel needs no pinger.

**AI on free models**
- **Two providers with automatic fallback:** if the primary returns a rate-limit or error, retry once, then switch to the secondary.
- **One model adapter** (`lib/llm.ts`) so the provider can change without touching agent code; both must support tool calling or reliable JSON output.
- **Cache** the replies for the three demo scenarios (by conversation state hash), so judges get instant, reliable answers even if a free tier is busy.
- **Keep calls small:** short prompts, compact context, no unnecessary agent turns.
- **Never put API keys in the browser**; all LLM calls go through the backend.
- Check each provider's current free-tier limits and terms today; free tiers may use prompts for training, so the demo uses only fictional data.

### Agent design: who can do what

The LLM never moves money or edits invoices directly.

| Tool | Who calls it | Notes |
|---|---|---|
| `get_invoice`, `list_invoices` (Toolkit) | LLM | Read-only context |
| `get_client_history` (ours) | LLM | On-time rate, previous invoices |
| `send_message` (ours) | LLM | Message to client page; rate-limited |
| `propose_offer` (ours) | LLM | Returns JSON: `{type: "discount" \| "plan" \| "pay_later", terms}` |
| `escalate`, `flag_dispute` (ours) | LLM | To the owner's queue |
| `create_conditional_rules_for_invoice` (Toolkit) | Executor, after guard | Early-payment discount |
| `cancel_sent_invoice`, `create_invoice`, `send_invoice` (Toolkit) | Executor, after guard | Void & reissue, installments |
| `send_invoice_reminder` (Toolkit) | Executor / scheduler | Gentle PayPal-native reminder |
| `record_payment_for_invoice` (Toolkit) | Executor | Marks invoice paid when paid through a Pay Later order |

**Policy guard (code):**
- Discount ≤ `max_discount_pct`
- Installments ≤ `max_installments`; first payment ≥ `min_first_payment_pct`
- Sum of installments = invoice amount (− approved discount)
- Invoice amount ≥ `approval_threshold` → always owner approval
- Max messages per day; no messages at night (client time zone if known)
- Any unknown field, wrong type or amount mismatch → reject

**Intent gate (before every agent turn):**
- `DISPUTE` ("the work was broken", "I never got it") → stop negotiation, alert owner
- `INJECTION` ("ignore the rules", "the owner approved 90%") → reply politely that changes need the business owner, log it, no concession
- `PAYMENT_HARDSHIP`, `FORGOT`, `QUESTION` → normal agent flow

### PayPal flows

**Early-payment discount**
1. Client accepts "5% off if paid within 48 hours."
2. Guard checks policy → executor calls `create_conditional_rules_for_invoice`.
3. **Fallback** if the rule doesn't behave as needed in Sandbox: cancel the invoice ("Superseded by agreement"), create + send a new one at the discounted amount, link `parent_invoice_id`.

**Installment plan (staged)**
1. Client accepts 3 × $400.
2. Executor cancels the original invoice, creates and sends **installment 1** now.
3. Installments 2 and 3 are stored as `SCHEDULED` with due dates.
4. The scheduler (triggered by the demo clock, or a timed job) creates and sends each one on its date.
5. Optional alternative: one invoice with `allow_partial_payment` and a minimum amount due.

**Pay Later (should have)**
1. Client page shows PayPal JS SDK buttons with Pay Later enabled for the invoice amount (Orders API).
2. If PayPal offers Pay Later to that client, they can choose it; the merchant is paid upfront.
3. On capture, executor calls `record_payment_for_invoice` on the original invoice.
4. **Verify on day 1** that Pay Later appears in Sandbox for a US buyer account. If not, show it as "available at PayPal checkout for eligible clients" without a live demo.

**Payment confirmation**
- Webhooks: `INVOICING.INVOICE.PAID`, `INVOICING.INVOICE.CANCELLED`, `PAYMENT.CAPTURE.COMPLETED`.
- Verify each webhook with PayPal's verify-webhook-signature API using all transmission headers.
- Store event IDs in `processed_events` to ignore duplicates.
- Poll invoice status every 30 s as a backup.

### Data model (Supabase)

```sql
create table businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  paypal_merchant_email text not null,
  currency text default 'USD',
  tone text default 'friendly'
);

create table policies (
  business_id uuid primary key references businesses(id),
  max_discount_pct numeric default 10,
  max_installments int default 3,
  min_first_payment_pct numeric default 30,
  approval_threshold numeric default 2000
);

create table clients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id),
  name text not null,
  email text not null,
  on_time_rate numeric
);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id),
  client_id uuid references clients(id),
  paypal_invoice_id text unique not null,
  parent_invoice_id text,
  amount numeric not null,
  currency text default 'USD',
  due_date timestamptz not null,
  status text not null,          -- SENT, PAID, CANCELLED, SUPERSEDED, PARTIALLY_PAID
  priority_score numeric default 0,
  priority_reason text
);

create table conversations (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references invoices(id),
  token text unique not null,
  status text default 'ACTIVE'   -- ACTIVE, RESOLVED, ESCALATED, DISPUTED
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id),
  sender text not null,          -- AGENT, CLIENT, OWNER
  content text not null,
  intent text,
  created_at timestamptz default now()
);

create table arrangements (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references invoices(id),
  type text not null,            -- DISCOUNT, PLAN, PAY_LATER
  terms jsonb not null,
  status text default 'PROPOSED', -- PROPOSED, PENDING_APPROVAL, ACCEPTED, REJECTED
  approved_by text               -- POLICY, OWNER
);

create table installments (
  id uuid primary key default gen_random_uuid(),
  arrangement_id uuid references arrangements(id),
  number int not null,
  amount numeric not null,
  due_date timestamptz not null,
  paypal_invoice_id text,
  status text default 'SCHEDULED' -- SCHEDULED, SENT, PAID
);

create table events (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  actor text not null,           -- AGENT, OWNER, SCHEDULER, PAYPAL
  payload jsonb,
  created_at timestamptz default now()
);

create table processed_events (
  paypal_event_id text primary key,
  created_at timestamptz default now()
);

create table demo_clock (
  id int primary key default 1,
  offset_days int default 0
);
```

### Main API routes

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/sync` | Pull invoices from PayPal |
| GET | `/api/invoices` | Dashboard data |
| PUT | `/api/policy` | Save owner rules |
| POST | `/api/invoices/:id/follow-up` | Start agent follow-up |
| GET | `/api/c/:token` | Client page data |
| POST | `/api/c/:token/message` | Client reply → intent gate → agent turn |
| POST | `/api/c/:token/accept` | Client accepts an offer → guard → executor |
| GET / POST | `/api/approvals`, `/api/approvals/:id` | Owner approval queue |
| POST | `/api/demo/clock` | Advance demo time; runs scheduler |
| POST | `/api/demo/reset` | Restore demo business and invoices |
| POST | `/api/paypal/webhook` | Payment events |

### Hosting (Vercel)

The app runs on Vercel's free Hobby plan. There is no `render.yaml` and no always-on server.

- Build command: `npm run build`
- Framework preset: Next.js (auto-detected)
- Production URL: `https://pulsepay-rho.vercel.app`
- Health check: `/api/health`
- Environment variables live in the Vercel project (never committed): `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `PAYPAL_ENVIRONMENT=sandbox`, `NEXT_PUBLIC_PAYPAL_CLIENT_ID`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `LLM_PRIMARY_API_KEY`, `LLM_FALLBACK_API_KEY`, `RESEND_API_KEY`, `NEXT_PUBLIC_APP_URL`.

Serverless functions on Hobby can run for up to 60 seconds. `/api/demo/reset` and the PayPal executor routes set `maxDuration = 60`.

There is no always-on cron on Hobby. For real (non-demo) installment dates, cron-job.org can call `/api/scheduler/run` hourly for free.

---

## 3. Design system

### Principles
1. **Calm money.** Clear and reassuring, not alarming.
2. **The owner stays in control.** Every agent action is visible and explained.
3. **The conversation is the product.** Messages are prominent on both sides.
4. **Numbers first.** Amounts and totals are large and scannable.
5. **The client side is friendly.** One thread, clear options, one pay button.

### Tokens

| Token | Value | Use |
|---|---|---|
| `--bg` | `#F7F8FA` | Background |
| `--surface` | `#FFFFFF` | Cards |
| `--ink` | `#0F172A` | Main text |
| `--ink-soft` | `#64748B` | Secondary text |
| `--line` | `#E2E8F0` | Borders |
| `--primary` | `#2453D6` | Main actions |
| `--primary-strong` | `#1B3FA6` | Pressed |
| `--recovered` | `#15803D` | Paid, recovered |
| `--due` | `#B45309` | 1–30 days late |
| `--overdue` | `#B91C1C` | 30+ days late |
| `--agent` | `#7C3AED` | Agent messages and actions |
| `--approval` | `#CA8A04` | Needs owner |

Dark mode: bg `#0B1120`, surface `#111827`, ink `#E5E7EB`; status colors slightly brighter.

**Typography:** Inter; tabular figures for amounts. Scale 13 / 14 / 16 / 20 / 28 / 40.
**Shape:** 4 px grid; 12 px card radius; 8 px inputs; 44 px touch targets.
**Icons:** Lucide, 20 px.

### Components
- **KpiStrip** — outstanding, overdue, recovered this month, needs approval.
- **AgingGrid** (AG Grid, Quartz theme) — client, amount, days late, priority (with AI reason tooltip), status, agent stage; aging buckets (row grouping if Enterprise, otherwise a bucket column + filter); green cell flash on payment; installment progress renderer ("1 of 3 paid · $400 / $1,200"); CSV export.
- **PolicyPanel** — discount, installments, first payment, approval threshold, tone.
- **ConversationThread** — agent (purple), client (grey), owner (blue), with action chips.
- **OfferCard** — Pay Later / discount / plan options with clear amounts.
- **ApprovalCard** — client request, agent recommendation, approve / reject / counter.
- **DisputeBanner** — automation paused, owner action needed.
- **ArrangementTimeline** — installment schedule with states.
- **AuditLog** — every action with actor and time.
- **DemoClock** — simulated date, "+1 day", "+1 week", "Reset demo".
- **LiveToast** — "Client paid installment 1 of 3: $400".

### Screens
1. Owner dashboard
2. Invoice detail (conversation, timeline, audit log)
3. Policy settings
4. Approvals and disputes
5. Client page (mobile-first)
6. Demo split view: owner dashboard + client page side by side

---

## 4. Team and roles

Everyone builds from today. The video is recorded together on Wednesday.

| Name | Role | Owns |
|---|---|---|
| **Oubay** | Tech lead / backend | Repo, Supabase schema, API routes, policy guard + Zod schemas, executor, demo clock + scheduler, Vercel deploy, health route, code review |
| **Omar** | PayPal engineer | Sandbox business + buyer accounts, Agent Toolkit setup, discount rule / void & reissue, installments, Pay Later checkout + record payment, webhooks + verification, seed script |
| **Reda** | AI agent engineer | Agent prompts and tones, tool definitions, intent gate (dispute / injection), negotiation flow, adversarial test suite, free model choice, LLM adapter with fallback + demo reply cache |
| **Taha** | Frontend / design | Design system, owner dashboard, AG Grid (licensing check today), invoice detail, policy settings, live updates, split view |
| **Soulaimane** | Client experience + messaging | Client page, offer cards, conversation thread, approval queue UI, dispute banner, Resend email |
| **Mohamed** | Data, scoring + quality | Priority scoring + reasons, client history stats, demo dataset and 3 scenarios, KPI calculations, end-to-end test every evening |

**Working rules**
- `main` always deployable; short branches; Oubay reviews PRs.
- Standup 10:00 (15 min); end-to-end run on the hosted URL 21:00 daily.
- Feature freeze **Tuesday 23:00**.

---

## 5. Day-by-day plan

| Day | Date | Goal | Done when |
|---|---|---|---|
| **1** | **Fri Nov 6 (today)** | Setup + risk checks | **Oubay:** repo, Supabase, Vercel deploy live, `/api/health` running. **Omar:** Sandbox accounts; Agent Toolkit installed; create, send, cancel, pay one invoice; test `create_conditional_rules_for_invoice`; check Pay Later appears for a US Sandbox buyer; webhook received and verified. **Reda:** free API keys from two providers; agent script negotiating a plan with proposals as JSON on both; first injection tests. **Taha:** tokens + dashboard layout; AG Grid licensing answer. **Soulaimane:** client page layout. **Mohamed:** dataset design (clients, histories, 3 scenarios). |
| **2** | Sat Nov 7 | Data flowing | Seed script creates 15–20 Sandbox invoices; sync to DB; AG Grid shows real invoices with priority scores; policy settings saved; guard + Zod in place |
| **3** | Sun Nov 8 | Agent ↔ client loop | Follow-up generated; client replies; intent gate works; offers within policy; escalations and disputes land in the owner queue |
| **4** | Mon Nov 9 | Agreement → PayPal → paid | Discount and plan executed in PayPal; client pays in Sandbox; webhook verified; row flashes green; demo clock sends installment 2 |
| **5** | Tue Nov 10 | Polish + **freeze 23:00** | Pay Later (if verified); approvals complete; audit log; email; error states; demo reset; split view; mobile tested |
| **6** | Wed Nov 11 | Hardening + video (whole team) | Morning: bug fixes, README, judge instructions. Afternoon: record + edit video together. Evening: full test from a fresh browser |
| **7** | Thu Nov 12 | **Submit by 14:00** | Devpost complete, video public, repo public with license, hosted demo verified |

**Critical path:** Omar's day 1 Sandbox checks and the day 4 agreement → payment loop. If late, cut in this order: weekly summary, email, Pay Later, CSV export. Never the core loop.

---

## 6. Making it easy for judges

- **"Open demo"** button: seeded business, no signup.
- **Split view** so one judge plays owner and client.
- **Three scenarios:**
  1. Forgot → friendly reminder → pays.
  2. Can't pay in full → Pay Later or 3 × $400 → pays installment 1.
  3. "Give me 40% off" or "ignore your rules" → guard blocks → owner approval → counter.
- Demo clock + reset button.
- Sandbox buyer credentials in the README.
- App, uptime pinger and free AI keys working through **Dec 15**; check the pinger's status page weekly.

---

## 7. Demo video (under 3 minutes)

| Time | Beat |
|---|---|
| 0:00–0:20 | Hook: a freelance designer with overdue PayPal invoices and ignored reminders. |
| 0:20–0:45 | Dashboard: invoices synced from PayPal, ranked by priority; owner sets rules in 10 seconds. |
| 0:45–1:35 | Split screen: personal follow-up; client says "I can't pay $1,200 this month"; agent offers Pay Later (if eligible) or 3 × $400; client picks the plan. |
| 1:35–2:10 | PayPal: original invoice superseded, installment 1 sent; client pays in PayPal; row flashes green; demo clock shows installment 2 going out. |
| 2:10–2:35 | Guardrails: client tries "the owner approved 90% off"; agent refuses politely; owner gets the request and counters in one tap. |
| 2:35–2:55 | How it works: PayPal Agent Toolkit + Invoicing, policy guard, AG Grid, Vercel. Close on the recovered total. |

English narration or subtitles; no copyrighted music or third-party logos.

---

## 8. Risks and fallbacks

| Risk | Fallback |
|---|---|
| Discount rule doesn't work as needed in Sandbox | Void & reissue |
| Pay Later not shown in Sandbox | Present it as available at PayPal checkout for eligible clients; demo the plan instead |
| Agent Toolkit missing a needed call | Raw REST for that call |
| Webhooks delayed | Polling backup every 30 s |
| Agent tries something outside policy | Guard blocks it; covered by adversarial tests |
| Prompt injection | Intent gate + guard; the LLM has no money-moving tools |
| AG Grid Enterprise not available | Community features only (flash, renderers, filters, export) |
| Email in spam | Client page link works alone; demo uses the page directly |
| Serverless cold starts | Warm the demo routes before judging; reset endpoint |
| Supabase free project paused for inactivity | Pinger's health check queries the database |
| Free AI tier rate-limited during judging | Fallback provider + cached demo replies |

---

## 9. Prizes we target

- **Best Overall**
- **Best Use of Agentic Commerce** — the agent negotiates and sets up real PayPal arrangements within owner rules
- **Best Use of PayPal + AI** — PayPal Agent Toolkit, Invoicing, Pay Later, AI at every step
- **Most Impactful** — late payments hurt freelancers and small businesses wherever PayPal operates
- **Best Use of AG Grid** — aging table with live updates
- **Best Use of Vercel** — hosting

---

## 10. Submission checklist

- [ ] Hosted demo working, tested from a fresh browser on desktop and mobile
- [ ] Public repo with all source, run instructions, visible open-source LICENSE
- [ ] Devpost description naming the AI model, PayPal Agent Toolkit and PayPal APIs used
- [ ] Public YouTube video under 3 minutes
- [ ] Sandbox buyer credentials and judge instructions in README
- [ ] All content in English
- [ ] Demo kept live through Dec 15 (pinger running, free AI keys valid)
- [ ] Submitted before 14:00 Morocco time, Thu Nov 12
