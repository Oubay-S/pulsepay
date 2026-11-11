# Mode Redesign Plan — re-skin PulsePay

> Execution brief for a coding agent. Source design system: `C:\Users\Hp\Documents\paypal-project\DESIGN.md` (Mode, outside the repo). Read it first.

## Goal
Apply the Mode look to the dashboard, client portal, approvals page and demo page:
forest green `#043F2E` + lime `#C8F169`, editorial serif for big headings, 4px buttons / 10px cards, colour-blocking instead of shadows, off-white canvas `#FCFCFC`.

**Rules**
- Visual changes only. Do **not** change any logic, data fetching, API routes, props, or component structure.
- Stay token-level where possible. Deadline: code freeze Tue Nov 10 23:00.
- Don't touch `src/lib/**` except `src/lib/email.ts` (step 7, optional).

## Why this is cheap
UI is already token-driven (~570 `var(--pp-*)` uses). Tokens are defined in **two** places that must stay in sync:
- `src/app/globals.css` → `:root` (dashboard `/`, `/demo`)
- `src/app/pulsepay-theme.css` → `.pp-portal, .ap-root` (portal `/c/[token]`, `/approvals` — re-declares the same tokens)

Changing those values does most of the work. Only ~30 hard-coded spots need edits.

## Deliberate deviations from DESIGN.md
- **Fonts:** Grenette/Graphik are paid. Use `Instrument Serif` (Google Fonts, weight 400) for display; keep `Inter` for body/UI.
- **`#EEF2E3` ("muted") is NOT used as text** — fails contrast. Use it only as a surface tint.
- **Link `#0000EE` not used** — links/focus use primary green.
- **Status colours** (DESIGN.md has none): keep existing amber/red for due/overdue; recovered stays green but distinct from brand green.
- **PayPal blue stays** on the PayPal-branded `.pp-pay-btn`. PayPal SDK smart buttons render their own colours — leave untouched.
- **No dark theme.** App is light-only.

## Token map (apply identically in BOTH token files)
| Token | New value |
|---|---|
| `--pp-bg` / `--pp-surface` | `#FCFCFC` / `#FFFFFF` |
| `--pp-bg-deep`, `--pp-surface-soft`, `--pp-surface-muted` | `#F4F6EE`, `#F4F6EE`, `#EEF2E3` |
| `--pp-surface-hover` | `rgba(4,63,46,0.04)` |
| `--pp-ink` / `--pp-ink-soft` / `--pp-ink-faint` / `--pp-ink-tertiary` | `#242524` / `#4A524C` / `#5F6862` / `#8A938C` |
| `--pp-line` / `--pp-line-strong` | `#E4E8DA` / `#D3D9C6` |
| `--pp-primary` / `-strong` / `-soft` / `-tint` | `#043F2E` / `#032E22` / `#EEF2E3` / `#F6F9EF` |
| **new** `--pp-on-primary` | `#C8F169` |
| **new** `--pp-lime` / `--pp-lime-soft` | `#C8F169` / `#F1FAD9` |
| `--pp-accent` / `-strong` / `-soft` / `-tint` / `-border` | `#2A6F2B` / `#043F2E` / `#EEF2E3` / `#F6F9EF` / `rgba(42,111,43,0.22)` |
| **new** `--pp-paypal` / `--pp-paypal-strong` | `#0070BA` / `#005EA6` |
| `--pp-recovered` / `-soft` / `-border` | `#1F7A3A` / `#F1FAD9` / `rgba(31,122,58,0.22)` |
| `--pp-owner` / `-soft` | `#043F2E` / `#EEF2E3` |
| `--pp-shadow-sm` / `--pp-shadow-md` | `none` / `0 1px 0 var(--pp-line)` (keep `--pp-shadow-lg` subtle — drawers/modals only) |
| `--pp-radius` / `--pp-radius-sm` | `10px` / `4px` |
| **new** `--pp-font-display` | `var(--font-display), Georgia, serif` |

Due / overdue / approval tokens: unchanged. `html, body` background in `pulsepay-theme.css` → `#FCFCFC`.

## Steps

### 0. Branch
- `git checkout main && git pull`, then `git checkout -b feat/reda-mode-design`.
- Copy `../DESIGN.md` → `docs/DESIGN.md`.

### 1. Fonts — `src/app/layout.tsx`
- Import `Instrument_Serif` from `next/font/google`: `weight: "400"`, `subsets: ["latin"]`, `variable: "--font-display"`, `display: "swap"`.
- Add its `.variable` to the `<html>` className next to `inter.variable`.
- `<body>` classes reference undefined vars (`--bg`, `--ink`, `--accent-tint`, `--primary`) → change to `--pp-bg`, `--pp-ink`, `--pp-lime-soft`, `--pp-primary`.

### 2. Tokens + shared utilities
- Update `src/app/globals.css` `:root` and `src/app/pulsepay-theme.css` per table.
- In `globals.css` add:
  ```css
  .pp-display {
    font-family: var(--pp-font-display);
    font-weight: 400;
    letter-spacing: -0.02em;
    line-height: 1.1;
  }
  ```
- `.glass-nav-light` → solid `background: var(--pp-primary)`, no blur, no shadow, no border.
- `.apple-card-light` → no box-shadow; hover changes border colour only.
- AG Grid block (`.ag-theme-quartz`): header bg `var(--pp-surface-muted)`, radius `10px`, no box-shadow.
- `.sidebar-active-indicator` → `var(--pp-primary)`. Sidebar background stays canvas.

### 3. Colour-blocked header band (Mode signature)
- **Dashboard** `src/app/page.tsx` `<header>` (~line 170–228): bg `var(--pp-primary)`; "PulsePay" wordmark uses `.pp-display` at ~20px in `#FCFCFC`; subtitle in `#FCFCFC` at ~70% opacity; "P" logo mark → lime bg + green text; "PayPal AI" chip → `--pp-lime-soft` bg, `--pp-primary` text, no blue border; "Judge Split View" button → lime bg + green text, 4px radius; refresh button → transparent with `rgba(252,252,252,0.3)` border and `#FCFCFC` icon. Hamburger icon colour `#FCFCFC`.
- **Portal** `src/app/c/[token]/portal.css`: `.pp-topbar` bg `var(--pp-primary)`, no box-shadow; `.pp-brand__name` `#FCFCFC`; `.pp-brand__sub` `rgba(252,252,252,0.7)`; `.pp-mark` lime bg + green text, 4px radius; `.pp-secure` transparent bg, `rgba(252,252,252,0.3)` border, `#FCFCFC` text, lime icon.
- **Approvals** `src/app/approvals/approvals.css`: same treatment on its top header/brand classes.

### 4. Display serif on big headings only (≥24px)
- Dashboard `h1` (`src/app/page.tsx` ~line 467): add `pp-display`, size 36px, drop `font-bold`.
- Approvals `h1` "Approvals & disputes" (`src/components/approvals/ApprovalsQueue.tsx` ~line 180) via its CSS class in `approvals.css`.
- Portal invoice amount `.pp-stub__amount` (44px) → display font, weight 400, letter-spacing `-0.02em`.
- `PortalError` title (`.pp-error-card__title`).
- **Do not** apply serif to KPI numbers, AG Grid cells, labels, buttons, or body text (financial readability).

### 5. Buttons → Mode spec
Primary = `var(--pp-primary)` bg, `var(--pp-on-primary)` text, 4px radius, no shadow, hover `var(--pp-primary-strong)`.
- **CSS:** `.pp-btn`, `.pp-btn--primary`, `.ap-btn`, `.ap-btn--primary` — radius `999px` → `4px`; primary text `#fff` → `var(--pp-on-primary)`. Secondary/ghost: transparent bg, `1px solid var(--pp-primary)` border, `var(--pp-primary)` text.
- **TSX** — pattern: `bg-[var(--pp-primary)] ... text-white ... shadow-sm ... rounded-xl|rounded-lg` → replace `text-white` with `text-[var(--pp-on-primary)]`, rounded with `rounded-[4px]`, remove `shadow-sm`. Files:
  - `src/app/page.tsx`
  - `src/app/demo/page.tsx`
  - `src/components/dashboard/ApprovalCard.tsx`
  - `src/components/dashboard/InvoiceDetailDrawer.tsx`
  - `src/components/dashboard/ClientPortalEmbed.tsx`
  - `src/components/dashboard/PolicyPanel.tsx`
  - `src/components/dashboard/AgingGrid.tsx` (~line 346, segmented filter)
- `.pp-pay-btn` (portal.css ~line 263): bg `var(--pp-paypal)`, hover `var(--pp-paypal-strong)`, white text, radius `4px`, remove box-shadow; `.pp-pay-btn > svg:first-of-type` colour `#fff`.
- Keep `999px` / `rounded-full` on dots, avatars, status pills, count badges, toggles.

### 6. Chat bubbles (the conversation is the product)
In `portal.css`:
- `.pp-bubble--agent` → bg `var(--pp-lime-soft)`, text `var(--pp-ink)`, no border/shadow, radius `16px 16px 16px 0`.
- `.pp-bubble--client` → bg `var(--pp-primary)`, text `#FCFCFC`, radius `16px 16px 0 16px`.
- `.pp-bubble--owner` → bg `var(--pp-surface-muted)`, text `var(--pp-ink)`.
- Avatars: `.pp-msg__avatar--agent` lime bg + green text; `--owner` green bg + lime text.

Mirror in dashboard: `InvoiceDetailDrawer.tsx` (~line 204 bubble classes) and `ClientPortalEmbed.tsx` (~line 179). Client/outgoing bubble text must be `#FCFCFC` on green.

### 7. Hard-coded colours
- `src/components/dashboard/AgingGrid.tsx` lines ~31–36 (AG Grid theme params): `borderColor #E4E8DA`, `headerBackgroundColor #EEF2E3`, `headerTextColor #5F6862`, `backgroundColor #FFFFFF`, `foregroundColor #242524`. Leave avatar colours.
- Overlays `bg-slate-900/40` and `bg-slate-900/30` (`InvoiceDetailDrawer.tsx`, `page.tsx`) → `bg-[#043F2E]/40`, `bg-[#043F2E]/30`.
- `portal.css` line ~13 and `approvals.css` line ~13 `background: #ffffff` → `var(--pp-bg)`.
- `DisputeBanner.tsx` uses undefined `--overdue` → `--pp-overdue`.
- Optional, last: `src/lib/email.ts` — swap brand near-black/blue hexes for `#043F2E` / `#C8F169`.

### 8. Cards
Visible top-level cards only — `KpiStrip`, `PolicyPanel`, `AuditLog`, `ApprovalCard`, `DemoClock`, `DisputeBanner`: `rounded-xl` / `rounded-2xl` → `rounded-[10px]`, remove `shadow-sm`/`shadow-md`. Don't hunt every instance.

## Files touched (owners — mention in PR)
Taha (dashboard components, `page.tsx`, `globals.css`), Soulaimane (portal CSS/components), Oubay (approvals). Visual pass only; no logic changed.

## Verification
1. `npx tsc --noEmit` → clean.
2. `npm test` → 45/45 pass.
3. `npx eslint` on changed files → clean.
4. `npm run build` (uses `--webpack`) → passes.
5. Run locally. **On this Windows machine `npm run dev` fails (Turbopack native bindings blocked) — use `npx next dev --webpack`.**
6. Check at 1440px and 375px wide:
   - `/` dashboard
   - `/demo`
   - `/c/demo-inv2-marcus-002` (active chat + offers)
   - `/c/demo-inv2-lumiere-007` (paid state)
   - `/approvals`
   
   Expect: green header band, serif headings, lime-on-green primary buttons, readable bubbles, PayPal pay button still blue, no horizontal scroll at 375px.
7. Grep checks:
   - No `text-white` left on `bg-[var(--pp-primary)]` buttons.
   - No `999px` radius on `.pp-btn` / `.ap-btn`.
8. Show screenshots to Reda before committing. Commit / push / PR only when asked.
