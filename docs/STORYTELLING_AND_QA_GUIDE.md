# PulsePay — Storytelling, Demo Scenarios & QA Protocol
**Owner / Author:** Mohamed (Data Engineering, Scoring & QA Lead)  
**Hackathon Target:** PayPal AI Hackathon 2026  
**Last Updated:** Saturday, November 7, 2026 (Day 2)

---

## 1. The Authentic Backstory & Personas

### A. The Business Owner (The Hero Persona)
- **Studio Name:** `Studio Chen Creative LLC`
- **Owner:** **Sarah Chen** (Award-winning freelance brand & digital product designer based in San Francisco / Remote).
- **Her Problem:** Sarah does incredible high-end work for startups and tech companies, but currently has **over $10,800 in overdue receivables** across PayPal invoices. 
- **Her Pain:** Chasing clients makes her feel uncomfortable and damages client relationships. She waits weeks before following up, causing cash flow choke points.

---

### B. The 8 B2B Clients & Invoices (Seeded in Database)

| Client & Role | Company | Invoice ID | Amount | Overdue | Status | Priority Score & AI Explainability |
|---|---|---|---|---|---|---|
| **Lucas Moreau**<br>Product Director | Solstice Robotics Inc. | `INV2-SOLSTICE-006` | **$1,750** | 68 days | `SENT` | **93** · 68 days overdue · $1,750 exposure · high-risk history (30% on-time) |
| **Julian Hayes**<br>VP Engineering | Vanguard Logic Systems | `INV2-ALEX-003` | **$3,500** | 35 days | `SENT` | **83** · 35 days overdue · $3,500 exposure · high-risk history (40% on-time) |
| **Dr. Aris Thorne**<br>Chief Medical Officer | Kroma BioTech Labs | `INV2-KROMA-004` | **$2,800** | 48 days | `SENT` | **78** · 48 days overdue · $2,800 exposure · moderate risk profile (55% on-time) |
| **Tariq Al-Mansoor**<br>Managing Partner | Oasis Ventures | `INV2-OASIS-008` | **$2,400** | 28 days | `PARTIALLY_PAID` | **57** · Staged plan active ($800 paid, 2 remaining) |
| **Marcus Reed**<br>Co-Founder & CEO | Apex Athletics | `INV2-MARCUS-002` | **$1,200** | 18 days | `SENT` | **50** · 18 days overdue · $1,200 exposure · moderate risk profile (65% on-time) |
| **Nadia Benali**<br>Head of Strategy | Atlas Media Group | `INV2-ATLAS-005` | **$650** | 12 days | `SENT` | **38** · 12 days overdue · $650 exposure · reliable client (85% on-time) |
| **Elena Rostova**<br>VP Marketing | Aura Health Media | `INV2-ELENA-001` | **$850** | 7 days | `SENT` | **35** · 7 days overdue · $850 exposure · reliable client (90% on-time) |
| **Chloe Dupont**<br>Creative Director | Lumière Studio Paris | `INV2-LUMIERE-007` | **$920** | Settled | `PAID` | **0** · Settled in full (feeds $920 to Recovered KPI) |

> PayPal generates the real `INV2-…` IDs at seed time. The IDs above are demo labels; the stable identifier is each client's token. Run `POST /api/demo/reset` to reseed all 8 real Sandbox invoices.

---

## 2. The 3 Live Demo Scenarios (For the Video & Judges)

### Scenario 1: The Forgetful Client (Warm Follow-Up & Instant Pay)
- **Target:** Elena Rostova (`INV2-ELENA-001` - $850)
- **Token:** `demo-inv2-elena-001` (or alias `demo-inv2-sarah-001`)
- **Flow:**
  1. Sarah's dashboard displays Elena's invoice as 7 days late.
  2. PulsePay crafts a warm, polite reminder: *"Hi Elena, quick check-in on the Q3 Brand Guidelines invoice..."*
  3. Elena opens the link on her phone, replies *"So sorry Sarah, totally slipped my mind! Paying now."*
  4. She clicks **Pay via PayPal** -> Instant sandbox payment -> Dashboard flashes green.

---

### Scenario 2: The Core Agentic Loop (PayPal Pay Later & 3x Installment Plan)
- **Target:** Marcus Reed (`INV2-MARCUS-002` - $1,200)
- **Token:** `demo-inv2-marcus-002`
- **Flow:**
  1. Marcus opens the portal and types: *"Hey Sarah, client revenue was delayed this month, I can't pay $1,200 right now."*
  2. PulsePay's Intent Gate recognizes **PAYMENT_HARDSHIP**.
  3. Agent presents two bounded options:
     - **Option A (PayPal Pay Later):** *"Did you know you can use PayPal Pay in 4? You pay in 4 bi-weekly installments, and Sarah receives 100% upfront today."*
     - **Option B (3-Part Staged Plan):** *"Alternatively, Sarah's policy allows a 3-part plan of $400 today, $400 next month, and $400 final."*
  4. Marcus clicks **Accept 3 × $400 Plan**.
  5. PulsePay supersedes the old invoice, dispatches Installment #1, and queues Installments #2 and #3.
  6. Marcus completes the $400 sandbox payment.

---

### Scenario 3: The Adversarial & Dispute Guardrail (Zero Hallucination)
- **Target:** Julian Hayes (`INV2-ALEX-003` - $3,500)
- **Token:** `demo-inv2-alex-003` (or `demo-inv2-julian-003`)
- **Flow:**
  1. Julian tries an adversarial negotiation: *"I want a 40% discount on this invoice or I will dispute the work."*
  2. The Intent Gate intercepts the message:
     - Detects `DISCOUNT_OUT_OF_POLICY` (40% > 10% policy limit).
     - Detects `DISPUTE_CLAIM` on work deliverables.
  3. The agent immediately ceases autonomous concessions, responds with a respectful neutral acknowledgment, and moves the request to Sarah's **Owner Approval Queue**.
  4. Sarah reviews the request on her dashboard and can approve, reject, or send a 1-tap counter-offer.

---

## 3. The 3-Minute Video Voiceover Script (Duration: 2 min 45 s)

```
[0:00 - 0:20] THE HOOK (Problem)
Visual: Sarah's screen with $10,800 in overdue PayPal invoices and an inbox of unanswered reminder emails.
Voiceover:
"Overdue invoices are the number one cash flow killer for freelancers and small businesses. But chasing clients is awkward, time-consuming, and often damages client relationships. 
Meet PulsePay: the empathetic AI financial agent that turns delinquent PayPal invoices into paid agreements."

[0:20 - 0:45] THE AG GRID DASHBOARD & POLICIES
Visual: Owner dashboard showing the AG Grid with Quartz theme, aging brackets (0-30, 31-60, 60+ days), and KPI cards.
Voiceover:
"PulsePay syncs directly with PayPal Invoicing in real time. It calculates explainable priority scores based on overdue days, invoice exposure, and client payment history. 
The owner sets crystal-clear policy boundaries in seconds: maximum 10 percent discount, up to 3 installments, and a polite, friendly tone."

[0:45 - 1:35] LIVE SPLIT-SCREEN DEMO (The Core Agentic Loop)
Visual: Split screen — Sarah's Dashboard on the left, Marcus's mobile phone on the right (/c/demo-inv2-marcus-002).
Voiceover:
"Here is Marcus Reed, 18 days overdue for a $1,200 design milestone. On the right, Marcus opens his client portal and replies: 'I'm tight on cash this month, I can't afford $1,200 right now.'
PulsePay's agentic loop activates: it first presents PayPal Pay Later so Marcus pays over time while Sarah gets 100 percent upfront. Marcus chooses a 3-part installment plan within Sarah's rules."

[1:35 - 2:05] INSTANT PAYPAL SETTLEMENT & LIVE RECONCILIATION
Visual: Marcus clicks 'Accept Plan' -> PayPal Sandbox one-click payment -> Dashboard on left flashes green.
Voiceover:
"The moment Marcus accepts, PulsePay supersedes the old invoice and generates Installment 1 via the PayPal Invoicing API. Marcus checks out in PayPal Sandbox.
Watch the dashboard on the left: via Supabase Realtime, the invoice row flashes green, $400 moves directly into 'Recovered This Month', and Installment 2 is staged in the scheduler."

[2:05 - 2:30] ADVERSARIAL DEFENSE & OWNER APPROVAL QUEUE
Visual: Third client asks for 40% discount -> Approval Queue badge turns yellow -> 1-click counter.
Voiceover:
"What happens if a client attempts prompt injection or demands a 40 percent discount? PulsePay's deterministic policy guard prevents any hallucination. 
It halts automation and routes the request to the Owner Approval Queue, where Sarah retains full authority to counter-offer in one click."

[2:30 - 2:45] CONCLUSION & PRIZE SUMMARY
Visual: Full architecture slide showcasing PayPal Invoicing API v2, PayPal Agent Toolkit, AG Grid, and Render.
Voiceover:
"PulsePay: Cash flow recovered. Business relationships preserved. Built for what's next with PayPal and AI."
```

---

## 4. Daily QA Protocol (21:00 Evening Checklist)

Run this checklist every evening on the deployed Vercel/Render URL (`https://pulsepay-rho.vercel.app`):

1. **Uptime & DB Check:** Visit `/api/health`. Verify HTTP 200 with `status: "ok"`.
2. **Dashboard Query:** Visit `/api/invoices`. Verify 8 invoices are returned with valid KPI sums.
3. **Reset & Seed Verification:** Click the **Reset Demo Data** button (or call `POST /api/demo/reset`). Verify data resets in under 3 seconds.
4. **Conversation Token Health:** Check `GET /api/c/demo-inv2-marcus-002`. Verify thread and invoice summary load without errors.
5. **Mobile Responsiveness:** Open the client link on your mobile phone. Verify text box and buttons are easily tap-able.
6. **Automated Unit Suite:** Run `npm test` locally to ensure 18/18 tests pass before approving PRs.
