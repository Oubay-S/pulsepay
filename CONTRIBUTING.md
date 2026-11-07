# PulsePay — Team Contribution & Workflow Guide

Welcome to the **PulsePay** repository for the **PayPal AI Hackathon 2026**!

## Quick Setup

1. **Clone repository & checkout your branch**:
   ```bash
   git clone https://github.com/Oubay-S/pulsepay.git
   cd pulsepay
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment**:
   ```bash
   cp .env.example .env.local
   ```
   *Ask Oubay for the shared Supabase Sandbox keys and credentials.*

4. **Verify local server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) and check [http://localhost:3000/api/health](http://localhost:3000/api/health).

---

## Branching & PR Rules

- `main` is protected and always deployable.
- Work on your dedicated feature branch:
  - **Omar**: `feat/omar-paypal-toolkit`
  - **Reda**: `feat/reda-agent-prompts`
  - **Taha**: `feat/taha-dashboard-ui`
  - **Soulaimane**: `feat/soulaimane-client-portal`
  - **Mohamed**: `feat/mohamed-scoring-data`
- Always verify before opening a PR:
  ```bash
  npm run build
  ```
- Open PR against `main`. **Oubay** reviews and merges.

---

## Architecture Map

- `src/types/` — **Shared TypeScript contracts**. Do not modify breaking changes without alignment.
- `src/app/api/` — 12 pre-built Next.js Route Handlers.
- `src/lib/guard/` — Zod policy guard (validates all agent proposals).
- `src/lib/paypal/` — PayPal API and executor methods (Omar).
- `src/lib/agent/` — Intent gate & agent tools (Reda).
- `src/lib/scoring.ts` — Priority scoring algorithm (Mohamed).
- `supabase/migrations/` — Database schema & Realtime config.
