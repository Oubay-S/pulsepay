---
version: alpha
name: Mode
description: |
  Mode's design system embodies confident enterprise sophistication paired with
  approachable clarity. The palette juxtaposes a deep forest green with vibrant
  lime-yellow, creating visual tension that communicates both professional
  stability and forward momentum. Typography relies on two distinct voices:
  Grenette for commanding display sizes with pronounced negative tracking that
  evokes editorial presence, and Graphik for utilitarian body text and interface
  labels. The overall aesthetic feels deliberately hybrid—modern BI meets
  human-centered communication. Rounded corners are minimal and purposeful
  (never exceeding 10px), reinforcing precision over playfulness. Color-blocking
  replaces subtle shadows as the primary depth tool, with alternating surface
  bands creating visual rhythm rather than layered elevation.
source:
  url: "https://mode.com/"
  pagesAnalyzed: 6
  extractedAt: 2026-11-09
  tokensMeasured: true
colors:
  primary: "#043F2E"
  accent: "#C8F169"
  link: "#0000EE"
  canvas: "#FCFCFC"
  surface-alt: "#2A6F2B"
  on-primary: "#C8F169"
  ink: "#000000"
  body: "#242524"
  muted: "#EEF2E3"
  accent-1: "#191925"
  accent-2: "#78C51C"
typography:
  display-xxl:
    fontFamily: Graphik
    fontSize: 100px
    fontWeight: 400
    lineHeight: 0.9
    letterSpacing: 0px
  display-xl:
    fontFamily: Grenette
    fontSize: 96px
    fontWeight: 400
    lineHeight: 0.9
    letterSpacing: -1.92px
  display-lg:
    fontFamily: Grenette
    fontSize: 72px
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: -1.44px
  display-md:
    fontFamily: Grenette
    fontSize: 70px
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: -2.1px
  display-sm:
    fontFamily: Grenette
    fontSize: 56px
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: -1.12px
  display-sm-tight:
    fontFamily: Grenette
    fontSize: 56px
    fontWeight: 400
    lineHeight: 1.12
    letterSpacing: -3px
  heading-md:
    fontFamily: Graphik
    fontSize: 36px
    fontWeight: 400
    lineHeight: 1.03
    letterSpacing: -0.36px
  heading-md-tight:
    fontFamily: Grenette
    fontSize: 36px
    fontWeight: 400
    lineHeight: 1.31
    letterSpacing: -1.12px
  heading-md-grenette:
    fontFamily: Grenette
    fontSize: 36px
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: -1.44px
  heading-md-strong:
    fontFamily: Grenette
    fontSize: 36px
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: 0.16px
  heading-sm:
    fontFamily: Graphik
    fontSize: 24px
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: 0.16px
  heading-xs:
    fontFamily: Graphik
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.67
    letterSpacing: 0px
    textTransform: uppercase
  body-lg:
    fontFamily: Graphik
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: 0px
  body-lg-strong:
    fontFamily: Graphik
    fontSize: 18px
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: 0px
  body-md:
    fontFamily: Graphik
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: 0px
  body-md-strong:
    fontFamily: Graphik
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: 0px
  body-md-loose:
    fontFamily: Graphik
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.44
    letterSpacing: 0px
  body-md-uppercase:
    fontFamily: Graphik
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: 0.84px
    textTransform: uppercase
  button-md:
    fontFamily: Graphik
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.18
    letterSpacing: 0px
  button-sm:
    fontFamily: Graphik
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1
    letterSpacing: 0px
  caption-xs:
    fontFamily: Graphik
    fontSize: 12px
    fontWeight: 400
    letterSpacing: 0px
  caption-xs-strong:
    fontFamily: Graphik
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1
    letterSpacing: 10px
    textTransform: uppercase
rounded:
  none: 0px
  xs: 3.5px
  sm: 4px
  md: 8px
  lg: 10px
  full: 9999px
spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 20px
  xl: 24px
  xxl: 28px
  xxxl: 32px
  section: 40px
  band: 56px
borderWidths:
  thin: 1px
elevationStrategy: color-blocking
themes:
  derived: dark   # the other theme is the site's measured palette
  light:
    bg: "#FCFCFC"
    surface: "#2A6F2B"
    surfaceRaised: "#286B29"
    text: "#000000"
    textMuted: "#242524"
    border: "#DEDEDE"
    accent: "#043F2E"
    accentFg: "#FFFFFF"
    focusRing: "#043F2E"
    elevation: shadow
  dark:
    bg: "#0D1111"
    surface: "#1C1F1F"
    surfaceRaised: "#282B2B"
    text: "#F5F7F7"
    textMuted: "#9DA0A0"
    border: "#343737"
    accent: "#0A9F74"
    accentFg: "#0B0B0C"
    focusRing: "#087958"
    elevation: "border+surface"
  contrastFailures:
    - "light: text on surface = 3.41:1 (needs 4.5:1)"
components:
  button-primary:
    textColor: "{colors.on-primary}"
    border: "1px solid {colors.primary}"
    height: 49px
    padding: "17px 30px 16px 30px"
    fontSize: 16px
    fontFamily: Graphik
    fontWeight: 400
    rounded: "{rounded.sm}"
    backgroundColor: "{colors.primary}"
  button-filled:
    typography: "{typography.body-md-strong}"
    textColor: "{colors.primary}"
    border: "1px solid {colors.muted}"
    height: 50.4062px
    padding: "17px 30px 16px 30px"
    rounded: "{rounded.sm}"
    backgroundColor: "{colors.muted}"
  button-primary-lg:
    textColor: "{colors.ink}"
    height: 58.875px
    padding: "2px 36px 2px 36px"
    fontSize: 16px
    fontFamily: Graphik
    fontWeight: 400
    rounded: "{rounded.sm}"
    backgroundColor: "{colors.primary}"
  button-outline:
    typography: "{typography.body-md-strong}"
    textColor: "{colors.muted}"
    border: "1px solid {colors.muted}"
    height: 50.4062px
    padding: "17px 30px 16px 30px"
    rounded: "{rounded.sm}"
  button-outline-sm:
    textColor: "{colors.primary}"
    border: "1px solid {colors.primary}"
    height: 49px
    padding: "17px 30px 16px 30px"
    fontSize: 16px
    fontFamily: Graphik
    fontWeight: 400
    rounded: "{rounded.sm}"
  button-text:
    typography: "{typography.body-md-loose}"
    textColor: "{colors.primary}"
    height: 20.1562px
  navigation:
    textColor: "{colors.ink}"
    height: 21.1562px
    fontSize: 16px
    fontFamily: Graphik
    fontWeight: 400
  navigation-lg:
    textColor: "{colors.ink}"
    height: 22.1562px
    fontSize: 16px
    fontFamily: Graphik
    fontWeight: 400
    lineHeight: 1.15
  footer:
    textColor: "{colors.canvas}"
    padding: "100px 0px 100px 0px"
    fontSize: 16px
    fontFamily: "Times New Roman"
    fontWeight: 400
    backgroundColor: "{colors.primary}"
  footer-lg:
    textColor: "{colors.canvas}"
    padding: "100px 0px 100px 0px"
    fontSize: 16px
    fontFamily: "Graphik Web"
    fontWeight: 400
    lineHeight: 1.15
    backgroundColor: "{colors.primary}"
  link:
    textColor: "{colors.primary}"
    padding: "16px 16px 16px 16px"
    fontSize: 16px
    fontFamily: Graphik
    fontWeight: 500
    rounded: 16px
    backgroundColor: "{colors.accent}"
  link-sm:
    textColor: "{colors.primary}"
    padding: "16px 16px 16px 16px"
    fontSize: 16px
    fontFamily: Graphik
    fontWeight: 500
    rounded: "16px 16px 16px 0px"
    backgroundColor: "{colors.accent}"
  card:
    textColor: "{colors.ink}"
    padding: "24px 0px 24px 0px"
    fontSize: 16px
    fontFamily: "Graphik Web"
    fontWeight: 400
    lineHeight: 1.15
  card-sm:
    textColor: "{colors.accent-1}"
    fontSize: 16px
    fontFamily: "Graphik Web"
    fontWeight: 400
    lineHeight: 1.15
    rounded: "{rounded.lg}"
    backgroundColor: "rgb(255, 255, 255)"
states:
  other-focus-visible:
    target: other
    state: focus-visible
    outline: "-webkit-focus-ring-color auto 1px"
    outlineColor: -webkit-focus-ring-color
    outlineWidth: 1px
  other-hover:
    target: other
    state: hover
    opacity: 1
  other-active:
    target: other
    state: active
    outline: none
  button-hover:
    target: button
    state: hover
    borderColor: currentcolor
    borderWidth: medium
  button-active:
    target: button
    state: active
    borderColor: currentcolor
    borderWidth: medium
  button-focus-visible:
    target: button
    state: focus-visible
    outline: "rgb(24, 99, 220) solid 2px"
    outlineColor: "rgb(24, 99, 220)"
    outlineWidth: 2px
  link-hover:
    target: link
    state: hover
    textColor: "rgb(18, 138, 72)"
  link-active:
    target: link
    state: active
    textColor: "rgb(6, 122, 59)"
breakpoints:
  - width: 375
    containerWidth: 343
    gridColumns: 1
    navLinksVisible: 35
    menuToggleVisible: false
    headingPx: 48
    bodyPx: 16
    sectionPaddingX: 16
  - width: 768
    containerWidth: 720
    gridColumns: 2
    navLinksVisible: 35
    menuToggleVisible: false
    headingPx: 72
    bodyPx: 16
    sectionPaddingX: 24
  - width: 1024
    containerWidth: 976
    gridColumns: 2
    navLinksVisible: 3
    menuToggleVisible: false
    headingPx: 72
    bodyPx: 16
    sectionPaddingX: 24
  - width: 1280
    containerWidth: 1248
    gridColumns: 2
    navLinksVisible: 3
    menuToggleVisible: false
    headingPx: 96
    bodyPx: 16
    sectionPaddingX: 24
  - width: 1440
    containerWidth: 1248
    gridColumns: 2
    navLinksVisible: 3
    menuToggleVisible: false
    headingPx: 96
    bodyPx: 16
    sectionPaddingX: 24
coverage:
  statesFound: 36
  gradientsFound: 0
  rolesUnassigned: 2
  archetypesUnnamed: 0
  archetypesDetected: 0
  responsiveMeasured: true
  stylesheetsBlocked: false
  semanticRampDeclared: false
---

# Design System Inspired by Mode

## 1. Visual Theme & Atmosphere

Mode's design system embodies confident enterprise sophistication paired with approachable clarity. The palette juxtaposes a deep forest green with vibrant lime-yellow, creating visual tension that communicates both professional stability and forward momentum. Typography relies on two distinct voices: Grenette for commanding display sizes with pronounced negative tracking that evokes editorial presence, and Graphik for utilitarian body text and interface labels. The overall aesthetic feels deliberately hybrid—modern BI meets human-centered communication. Rounded corners are minimal and purposeful (never exceeding 10px), reinforcing precision over playfulness. Color-blocking replaces subtle shadows as the primary depth tool, with alternating surface bands creating visual rhythm rather than layered elevation.

**Key Characteristics**

- Deep forest-green foundation paired with vivid lime-yellow accents
- Editorial-weight display typography with tight negative tracking
- Minimal border radius (4–10px) across interactive elements
- Color-blocking strategy for surface hierarchy instead of shadows
- High contrast between neutral surfaces and brand-colored accents
- Professional yet energetic visual personality
- Generous whitespace and measured section pacing

## 2. Color Palette & Roles

### Primary

- **Primary / Brand** (`{colors.primary}` — `#043F2E`): Primary CTA backgrounds, brand accent, active states, and footer surfaces. Defines the system's authoritative green identity.

### Accent Colors

- **Accent / On Primary** (`{colors.accent}` — `#C8F169`): Secondary accent and hero band labels that sit on brand-colored surfaces. High contrast against primary green.
- **Accent Decorative 1** (`{colors.accent-1}` — `#191925`): Decorative accent with no assigned role in measured patterns; available for emphasis or special cases.
- **Accent Decorative 2** (`{colors.accent-2}` — `#78C51C`): Decorative accent with no assigned role in measured patterns; available for emphasis or special cases.

### Interactive

- **Link** (`{colors.link}` — `#0000EE`): Inline hyperlink colour for standard link text.

### Neutral Scale

- **Canvas** (`{colors.canvas}` — `#FCFCFC`): Default page background and primary neutral surface.
- **Ink** (`{colors.ink}` — `#000000`): Headings and primary text colour.
- **Body** (`{colors.body}` — `#242524`): Body copy and secondary text.
- **Muted** (`{colors.muted}` — `#EEF2E3`): Captions, secondary text, and reduced-emphasis copy.

### Surface & Borders

- **Surface Alt** (`{colors.surface-alt}` — `#2A6F2B`): Alternating section band colour; a darker green variant that provides visual rhythm without breaking the brand.

## 3. Typography Rules

### Font Family

**Primary: Graphik** (sans-serif, modern utility type)
Fallback stack: `Graphik, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`

**Secondary: Grenette** (serif, editorial display type)
Fallback stack: `Grenette, Georgia, 'Times New Roman', serif`

Graphik dominates interface text, buttons, and body copy. Grenette reserves itself for large display headings where its high-contrast serifs and tight tracking command attention.

### Hierarchy

| Role | Font | Size | Weight | Line Height | Letter Spacing | Notes |
|---|---|---|---|---|---|---|
| Display XL | Grenette | 96px | 400 | 0.9 | -1.92px | Hero-scale heading, maximum impact |
| Display L | Grenette | 72px | 400 | 1.1 | -1.44px | Large section heading |
| Display MD | Grenette | 70px | 400 | 1.1 | -2.1px | Variant large heading |
| Display SM | Grenette | 56px | 400 | 1.2 | -1.12px | Medium display heading |
| Display SM Tight | Grenette | 56px | 400 | 1.12 | -3px | Compressed display variant |
| Display XXL | Graphik | 100px | 400 | 0.9 | 0px | Very large utility heading |
| Heading MD | Grenette | 36px | 400 | 1.2 | -1.44px | Serif medium heading |
| Heading MD Tight | Grenette | 36px | 400 | 1.31 | -1.12px | Serif medium with tighter spacing |
| Heading MD Graphik | Grenette | 36px | 400 | 1.2 | -1.44px | Serif medium standard |
| Heading MD Strong | Grenette | 36px | 500 | 1.2 | 0.16px | Serif medium emphasis |
| Heading SM | Graphik | 24px | 500 | 1.2 | 0.16px | Subheading, sans-serif |
| Heading XS | Graphik | 14px | 500 | 1.67 | 0px | UPPERCASE label, sans-serif |
| Body LG | Graphik | 18px | 400 | 1.3 | 0px | Large body copy |
| Body LG Variant | Graphik | 18px | 400 | 1.3 | 0.16px | Large body with tracking |
| Body MD | Graphik | 14px | 400 | 1.3 | 0px | Standard body copy |
| Body MD Strong | Graphik | 14px | 500 | 1.1 | 0px | Emphasis within body |
| Body MD Loose | Graphik | 14px | 500 | 1.44 | 0px | Relaxed line height variant |
| Body MD UPPERCASE | Graphik | 14px | 500 | 1.2 | 0.84px | Label text, uppercase |
| Button MD | Graphik | 16px | 500 | 1.18 | 0px | Standard button text |
| Button SM | Graphik | 14px | 500 | 1 | 0px | Small button text |
| Caption XS | Graphik | 12px | 400 | — | 0px | Smallest text tier |
| Caption XS Strong | Graphik | 12px | 500 | 1 | 10px | UPPERCASE caption emphasis |

### Principles

- Negative letter-spacing on Grenette display sizes (as tight as -3px) is intentional and defines editorial authority; do not normalize to 0.
- Graphik weights toggle between 400 (default) and 500 (emphasis) to avoid intermediate weights.
- Large heading line-heights compress below 1.2 to maintain visual tightness; body text expands to 1.3–1.44 for readability.
- Body copy defaults to `{colors.body}` (`#242524`), not pure black, for screen legibility; headings use `{colors.ink}` (`#000000`) for maximum contrast.
- Captions and secondary text reduce to 12–14px with `{colors.muted}` (`#EEF2E3`) for de-emphasis.

## 4. Component Stylings

### Buttons

#### Primary

- **Background**: `{colors.primary}` (`#043F2E`)
- **Text**: `{colors.accent}` (`#C8F169`)
- **Border**: 1px solid `{colors.primary}`
- **Padding**: 17px 30px 16px 30px
- **Height**: 49px
- **Border Radius**: `{rounded.sm}` (4px)
- **Font**: `{typography.button-md}` (16px, weight 500, line-height 1.18)
- **Box Shadow**: None
- **Hover**: Background darkens; text remains `{colors.accent}`
- **Active**: Applied via filter brightness reduction

#### Filled (Outline Inverse)

- **Background**: `{colors.muted}` (`#EEF2E3`)
- **Text**: `{colors.primary}` (`#043F2E`)
- **Border**: 1px solid `{colors.muted}`
- **Padding**: 17px 30px 16px 30px
- **Height**: 50.4px
- **Border Radius**: `{rounded.sm}` (4px)
- **Font**: `{typography.button-sm}` (14px, weight 500, line-height 1)
- **Box Shadow**: None
- **Hover**: Background lightens; border and text remain primary

#### Outline

- **Background**: Transparent (rgba 0/0/0/0)
- **Text**: `{colors.muted}` (`#EEF2E3`)
- **Border**: 1px solid `{colors.muted}`
- **Padding**: 17px 30px 16px 30px
- **Height**: 50.4px
- **Border Radius**: `{rounded.sm}` (4px)
- **Font**: `{typography.button-sm}` (14px, weight 500, line-height 1)
- **Box Shadow**: None
- **Hover**: Inverse; text and border change to `{colors.accent}` with transparent background

#### Outline Small

- **Background**: Transparent
- **Text**: `{colors.primary}` (`#043F2E`)
- **Border**: 1px solid `{colors.primary}`
- **Padding**: 17px 30px 16px 30px
- **Height**: 49px
- **Border Radius**: `{rounded.sm}` (4px)
- **Font**: `{typography.button-md}` (16px, weight 500, line-height 1.18)
- **Box Shadow**: None
- **Hover**: Background and text invert via colour variable binding

#### Text

- **Background**: Transparent
- **Text**: `{colors.primary}` (`#043F2E`)
- **Border**: None
- **Padding**: 0px
- **Height**: Auto
- **Border Radius**: `{rounded.none}` (0px)
- **Font**: `{typography.body-md-strong}` (14px, weight 500, line-height 1.1)
- **Box Shadow**: None
- **Hover**: Text underlines; no background change

### Cards & Containers

#### Default (Large)

- **Background**: Transparent / Inherited
- **Border**: None
- **Padding**: 24px 0px
- **Border Radius**: `{rounded.none}` (0px)
- **Font**: `{typography.body-lg}` (18px, weight 400, line-height 1.3)
- **Box Shadow**: None
- **Use**: Large content containers and sections

#### Default Small

- **Background**: `{colors.canvas}` (`#FCFCFC`)
- **Border**: None
- **Padding**: 0px (padding applied via child elements)
- **Border Radius**: `{rounded.lg}` (10px)
- **Width**: ~349px
- **Height**: ~256px
- **Font**: `{typography.body-lg}` (18px, weight 400, line-height 1.3)
- **Box Shadow**: None
- **Use**: Compact card tiles; typically displayed in grids

### Inputs & Forms

No explicit form input patterns were measured across the extraction. Refer to "Known Gaps" for interaction state coverage.

### Navigation

#### Default

- **Background**: Transparent
- **Text**: `{colors.ink}` (`#000000`)
- **Border**: None
- **Padding**: 0px
- **Height**: 21.2px
- **Border Radius**: `{rounded.none}` (0px)
- **Font**: `{typography.button-md}` (16px, weight 400, line-height normal)
- **Box Shadow**: None
- **Use**: Horizontal navigation links in header
- **Hover**: Text color changes to `{colors.link}` or alternate variant

### Footer

#### Default

- **Background**: `{colors.primary}` (`#043F2E`)
- **Text**: `{colors.canvas}` (`#FCFCFC`)
- **Border**: None
- **Padding**: 100px 0px
- **Height**: Auto (measured ~950px at 1440px viewport)
- **Border Radius**: `{rounded.none}` (0px)
- **Font**: Graphik or Times New Roman (weight 400, 16px, line-height normal)
- **Box Shadow**: None
- **Use**: Global footer band; full-width
- **Note**: Footer typography varies between Graphik Web and Times New Roman depending on measured variant

## 5. Layout Principles

### Spacing System

The system uses an 8px base unit scaled into a modular ladder:

- `{spacing.xxs}` = 4px — Micro-gap for adjacent elements or internal padding on small components
- `{spacing.xs}` = 8px — Minimum padding inside buttons or compact spacing between elements
- `{spacing.sm}` = 12px — Small spacing within grouped form fields or tight layouts
- `{spacing.md}` = 16px — Standard padding; used in input fields, small cards, and moderate gaps
- `{spacing.lg}` = 20px — Emphasis spacing between related content blocks
- `{spacing.xl}` = 24px — Card and container internal padding; space between visual groups
- `{spacing.xxl}` = 28px — Larger group spacing
- `{spacing.xxxl}` = 32px — Significant breathing room between sections
- `{spacing.section}` = 40px — Space between distinct content sections
- `{spacing.band}` = 56px — Vertical spacing between major visual bands (hero to content, etc.)

**Usage Context**: Buttons use `{spacing.md}` (16px) for internal padding; sections breathe at `{spacing.band}` (56px) vertical intervals. Whitespace hierarchy mirrors the typographic scale: larger headings sit in larger gutters.

### Grid & Container

- **Maximum Content Width**: 1248px (measured at 1280px+ viewport, remains constant at 1440px)
- **Grid Columns**: Consistently 2-column layout across all breakpoints measured
- **Section Padding (Horizontal)**: 16px at mobile (375px), expanding to 24px at tablet (768px) and desktop
- **Container Strategy**: Full-width sections with centered max-width inner content; no multi-column grids at mobile
- **Content Column Width**:
  - 375px viewport: 343px (full width minus 32px outer padding)
  - 768px viewport: 720px
  - 1024px+ viewport: 976–1248px

### Whitespace Philosophy

Whitespace is deliberate and measured. The design avoids cramped layouts by anchoring section spacing to the `{spacing.band}` scale (56px vertical gaps between major sections). Horizontal gutters expand from mobile (16px) to desktop (24px), respecting screen size while maintaining consistent margin rhythm. Hero sections use generous padding; body text sits in readable columns rather than edge-to-edge. Color-blocking (primary green, muted beige, accent yellow) creates perceived depth through surface change rather than shadow, so whitespace becomes the primary visual breather.

### Border Radius Scale

- `{rounded.none}` = 0px — Sharp corners on full-width sections, hero images, and block-level containers
- `{rounded.xs}` = 3.5px — Minimal rounding on subtle decorative elements
- `{rounded.sm}` = 4px — Standard button and small interactive element radius
- `{rounded.md}` = 8px — Modal windows and medium containers
- `{rounded.lg}` = 10px — Cards and larger contained elements (e.g., 349px card tiles)
- `{rounded.full}` = 9999px — Not observed in active use; reserved for pill-shaped components if needed

**Per Component**:
- Buttons: 4px
- Cards: 10px
- Modals: 8px
- Images: 0px
- Sections: 0px

### Border Widths

- **Thin**: 1px — Applied to button borders (primary, outline, and filled variants)

Borders are restrained; most interface elements rely on color-blocking rather than visible stroke.

## 6. Depth & Elevation

The Mode design system employs **color-blocking** as its primary depth strategy. Rather than layered shadows, surfaces communicate hierarchy through colour change:

- **Primary Green** (`{colors.primary}` — `#043F2E`) establishes the foundational brand layer, used for CTAs, active states, and footer surfaces.
- **Muted Beige** (`{colors.muted}` — `#EEF2E3`) provides a lighter, neutral lift for secondary actions or disabled states.
- **Surface Alt Green** (`{colors.surface-alt}` — `#2A6F2B`) creates visual rhythm through alternating section bands without introducing shadow depth.
- **Canvas** (`{colors.canvas}` — `#FCFCFC`) is the neutral baseline for all content regions.

**Elevation Philosophy**: The absence of significant box-shadows reinforces a flat, modern aesthetic where optical weight comes from color saturation and contrast rather than simulated depth. Interactive elements (buttons, cards) signal elevation through colour inversion or border change on hover, not through increased shadow blur.

### Opacity Levels

- **0%** (opacity: 0.00) — Hidden; not visible
- **8%** (opacity: 0.08) — Minimal overlay or faint background wash
- **40%** (opacity: 0.40) — Moderate transparency for disabled or reduced-emphasis states
- **74%** (opacity: 0.74) — Near-full opacity; subtle transparency for layered elements
- **100%** (opacity: 1.00) — Fully opaque; default for all content

### Z-index / Layering

Stacking contexts are minimal and deliberate:

| Layer | Z-index | Use |
|---|---|---|
| Base | 1 | Static content, standard page flow |
| Base | 2 | Slightly elevated static elements |
| Base | 3 | Neutral layers, cards |
| Base | 4 | Raised containers |
| Base | 5 | Sticky or elevated content |
| Base | 6 | High-priority content |
| Dropdown | 10 | Menus, select dropdowns, popovers |
| Dropdown | 15 | Modal overlays, high-priority dropdowns |

This restrained scale avoids z-index conflicts and keeps the hierarchy simple. Dropdowns and modals occupy the 10–15 range exclusively.

## 7. Do's and Don'ts

### Do

- **Use `{colors.primary}` for primary CTAs.** All main call-to-action buttons must use the forest green background with `{colors.accent}` text.
- **Maintain button padding at 17px vertical and 30px horizontal.** Consistency across all button sizes reinforces interface stability.
- **Apply negative letter-spacing to Grenette display text.** The -1.92px to -3px tracking is essential to the editorial character; do not normalize to 0.
- **Space sections vertically using `{spacing.band}` (56px).** This creates predictable rhythm across pages.
- **Use color-blocking for visual hierarchy instead of shadows.** Alternate surfaces (primary, muted, canvas) to communicate depth and grouping.
- **Keep border-radius minimal: 4px for buttons, 10px for cards, 0px for sections.** This precision reinforces the professional aesthetic.
- **Test interactive text against `{colors.link}` (#0000EE) for inline hyperlinks.** The bright blue stands out against neutral text.
- **Expand section padding to 24px horizontal on tablet and desktop.** Mobile uses 16px; larger screens need more breathing room.
- **Ensure body text uses `{colors.body}` (#242524), not pure black.** This improves on-screen readability and feels more refined.

### Don't

- **Don't use the accent green (`{colors.surface-alt}`) for primary buttons.** It is reserved for alternating section bands and secondary emphasis.
- **Don't apply shadows for depth.** The system achieves hierarchy through color. Avoid box-shadow except where explicitly measured (e.g., specific hover states).
- **Don't round button corners beyond 4px.** The sharp corners (relative to other systems) are intentional and signal precision.
- **Don't invert the link color.** `{colors.link}` (#0000EE) is specified for inline links; alternatives dilute consistency.
- **Don't compress line-height below 1.1 on body copy.** Maintain readability by keeping body line-height at 1.3 or higher.
- **Don't use Grenette for interface labels or small text.** Its high-contrast serif nature is reserved for large display headings only. Body and UI text must use Graphik.
- **Don't exceed 1248px content width on desktop.** The measured max-width ensures text columns remain readable and layouts don't sprawl.
- **Don't skip the alternating surface bands.** Color-blocking with `{colors.surface-alt}` is how the system communicates section boundaries.
- **Don't use pure white for backgrounds.** Canvas is `#FCFCFC` (off-white) for a softer, less harsh on-screen appearance.
- **Don't add interactive states not explicitly measured.** Hover, focus, and active states are fragile; only implement what the extraction confirmed.

## 8. Responsive Behavior

### Breakpoints

| Breakpoint | Viewport Width | Content Column | Grid Columns | Heading Size | Body Font | Section Padding X | Key Changes |
|---|---|---|---|---|---|---|---|
| Mobile | 375px | 343px | 1 | 48px (48px display) | 14px | 16px | Stacked layout; mobile-optimized nav; largest heading is display-sm compressed |
| Tablet | 768px | 720px | 2 | 72px | 14px | 24px | Two-column grid begins; heading expands to display-md |
| Desktop Small | 1024px | 976px | 2 | 72px | 14px | 24px | Wider content column; nav links fully visible (no hamburger) |
| Desktop | 1280px | 1248px | 2 | 96px | 14px | 24px | Max-width content; display-xl headings at full scale |
| Desktop Large | 1440px | 1248px | 2 | 96px | 14px | 24px | Content width remains capped; no further expansion |

**Responsive Strategy**: The system expands gracefully rather than adding complexity. Mobile (375px) uses a single-column stack with 16px padding. Tablet (768px) introduces a 2-column grid and increases padding to 24px. Desktop (1024px+) maintains the 2-column structure but caps content width at 1248px to prevent line lengths from becoming unreadable. Heading sizes scale with breakpoint: 48px at mobile, 72px at tablet, 96px at desktop.

### Touch Targets

No explicit touch target minimum was measured in the extraction. Based on button dimensions observed:

- **Buttons**: Minimum 49px height (measured on primary button), 16px width comfortably exceed 44px mobile touch target.
- **Navigation Links**: Assume 48px vertical hit area; horizontal spacing maintains 16px+ gaps.
- **Interactive Text**: Caption links and small text (12–14px) should be padded to at least 44px touch area.

### Collapsing Strategy

- **Mobile (375px)**: Single-column layout; all content stacks vertically. Hero images and large cards occupy full width minus 16px padding. Navigation collapses (link count visible: 35, but assume hamburger at smaller breakpoints).
- **Tablet (768px)**: Two-column grid activates. Sections expand to full available width but maintain 24px side padding. Large hero text (72px) takes primary visual weight.
- **Desktop (1024px+)**: Content width caps at 976–1248px; navigation expands to full horizontal display (3 links visible in header). Sections remain centered; unused viewport space is whitespace.
- **Large Desktop (1440px)**: No further layout shift; content remains at 1248px max-width, centered on screen. All interactive elements and typography remain at their 1280px scale.

**No hamburger toggle was observed in the extraction** across 375px to 1440px range, suggesting the site may maintain horizontal nav at all scales or the menu pattern exists off the measured pages.

## 9. Agent Prompt Guide

### Quick Color Reference

- **Primary CTA**: Primary / Brand (`{colors.primary}` — `#043F2E`)
- **Secondary CTA**: Accent / On Primary (`{colors.accent}` — `#C8F169`)
- **Background**: Canvas (`{colors.canvas}` — `#FCFCFC`)
- **Heading Text**: Ink (`{colors.ink}` — `#000000`)
- **Body Text**: Body (`{colors.body}` — `#242524`)
- **Secondary Text**: Muted (`{colors.muted}` — `#EEF2E3`)
- **Section Band**: Surface Alt (`{colors.surface-alt}` — `#2A6F2B`)
- **Inline Link**: Link (`{colors.link}` — `#0000EE`)

### Iteration Guide

1. **Primary buttons always use forest green background (`#043F2E`) with lime-yellow text (`#C8F169`).** Never invert or use alternative colors for main CTAs.

2. **Button padding is strictly 17px top/bottom and 30px left/right.** Border-radius is 4px. Height is 49px (standard) or 50.4px (filled variant).

3. **All body text defaults to `#242524` (body), not pure black.** Headings alone use `#000000` (ink) for maximum contrast. Secondary text uses `#EEF2E3` (muted).

4. **Grenette (serif) is display-only: use it for headings 36px and above.** Graphik (sans-serif) handles all body, buttons, and labels. No exceptions.

5. **Apply negative letter-spacing to Grenette: -1.44px to -3px depending on size.** This tight tracking is intentional and defines the editorial voice.

6. **Sections space at 56px vertical intervals (`{spacing.band}`)** and 16px (mobile) or 24px (desktop) horizontal padding.

7. **Color-blocking replaces shadows for hierarchy.** Use `{colors.primary}`, `{colors.surface-alt}`, and `{colors.canvas}` to create visual rhythm; avoid box-shadow.

8. **Max-width is 1248px on desktop (1280px+ viewport).** Content never exceeds this, even on 1440px screens.

9. **Hover states on buttons apply a brightness filter or color-variable binding** (as specified in interaction data); do not invent new hover effects.

10. **Cards use 10px border-radius; images and sections use 0px.** This precision is essential to the design character.

11. **Link text is always `#0000EE` (standard web blue).** On hover, it may shift to green variants (`#128A48` or `#067A3B`); apply only as extraction confirmed.

12. **Footer uses primary green background with off-white text.** Padding is 100px vertical; fonts are Graphik or Times New Roman (16px, weight 400).

## 10. Known Gaps

- **No semantic status colours (error/success/warning).** The extraction found no success, warning, or error states in the site's CSS. Status handling is unmeasured.
- **No explicit form input styling.** Input fields, checkboxes, radio buttons, and form validation states were not measured. Refer to brand guidelines or a follow-up audit for form patterns.
- **Two accent colours (`{colors.accent-1}` #191925 and `{colors.accent-2}` #78C51C) have no measured role.** They appear in the extraction but lack evidence of use; treat as decorative reserves.
- **No gradients or mesh overlays.** The system uses flat colour-blocking; no gradients or complex backgrounds were observed.
- **Opacity levels were extracted but not tied to specific component states.** The values (0%, 8%, 40%, 74%, 100%) exist but lack context. Disabled state opacity is unmeasured.
- **Z-index scale is minimal (1–6 base, 10–15 dropdown).** No modal, toast, or tooltip stacking orders were explicitly confirmed; this is an inferred ladder.
- **Interaction states are partial.** Hover and active states on buttons are measured, but focus-visible, focus, and disabled states lack full coverage across all component types.
- **No dark-mode or theme switching.** The extraction captures one light theme; any dark-mode counterpart was not measured.
- **Surfaces behind authentication (login, account dashboards) were not visited.** The design system may differ in authenticated contexts.
- **No animation or transition timing.** CSS transitions and @keyframes were not extracted; the document captures static styling only.
- **Hamburger menu toggle is not confirmed.** Navigation behaviour at sub-375px may differ; the extracted breakpoint assumes horizontal nav persists at all sizes within the measured range.
- **Caption and small-text hover states are incomplete.** Large button and primary link hovers are measured; caption and helper text interaction is not.
- **No gradient or conditional styling for colour accessibility.** No high-contrast mode, reduced-motion preferences, or prefers-color-scheme variants were measured.

---

# Token Reference

```yaml
colors:
  primary: "#043F2E"
  accent: "#C8F169"
  link: "#0000EE"
  accent-1: "#191925"
  accent-2: "#78C51C"
  canvas: "#FCFCFC"
  surface-alt: "#2A6F2B"
  ink: "#000000"
  body: "#242524"
  muted: "#EEF2E3"

typography:
  body-md-strong:
    size: 14px
    weight: 500
    line-height: 1.1
    letter-spacing: 0px
  body-md:
    size: 14px
    weight: 400
    line-height: 1.3
    letter-spacing: 0px
  body-md-loose:
    size: 14px
    weight: 500
    line-height: 1.44
    letter-spacing: 0px
  body-lg-strong:
    size: 18px
    weight: 500
    line-height: 1.3
    letter-spacing: 0px
  body-md-uppercase:
    size: 14px
    weight: 500
    line-height: 1.2
    letter-spacing: 0.84px
    transform: uppercase
  caption-xs:
    size: 12px
    weight: 400
    letter-spacing: 0px
  body-lg:
    size: 18px
    weight: 400
    line-height: 1.3
    letter-spacing: 0px
  heading-md:
    size: 36px
    weight: 400
    line-height: 1.03
    letter-spacing: -0.36px
  button-sm:
    size: 14px
    weight: 500
    line-height: 1
    letter-spacing: 0px
  button-md:
    size: 16px
    weight: 500
    line-height: 1.18
    letter-spacing: 0px
  heading-sm:
    size: 24px
    weight: 500
    line-height: 1.2
    letter-spacing: 0.16px
  heading-xs:
    size: 14px
    weight: 500
    line-height: 1.67
    letter-spacing: 0px
    transform: uppercase
  display-xxl:
    size: 100px
    weight: 400
    line-height: 0.9
    letter-spacing: 0px
  caption-xs-strong:
    size: 12px
    weight: 500
    line-height: 1
    letter-spacing: 10px
    transform: uppercase
  heading-md-tight:
    size: 36px
    weight: 400
    line-height: 1.31
    letter-spacing: -1.12px
  display-sm:
    size: 56px
    weight: 400
    line-height: 1.2
    letter-spacing: -1.12px
  display-lg:
    size: 72px
    weight: 400
    line-height: 1.1
    letter-spacing: -1.44px
  heading-md-grenette:
    size: 36px
    weight: 400
    line-height: 1.2
    letter-spacing: -1.44px
  display-md:
    size: 70px
    weight: 400
    line-height: 1.1
    letter-spacing: -2.1px
  display-xl:
    size: 96px
    weight: 400
    line-height: 0.9
    letter-spacing: -1.92px
  heading-md-strong:
    size: 36px
    weight: 500
    line-height: 1.2
    letter-spacing: 0.16px
  display-sm-tight:
    size: 56px
    weight: 400
    line-height: 1.12
    letter-spacing: -3px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 20px
  xl: 24px
  xxl: 28px
  xxxl: 32px
  section: 40px
  band: 56px

rounded:
  none: 0px
  xs: 3.5px
  sm: 4px
  md: 8px
  lg: 10px
  full: 9999px

opacity:
  none: 0.00
  faint: 0.08
  reduced: 0.40
  high: 0.74
  full: 1.00

z-index:
  base-1: 1
  base-2: 2
  base-3: 3
  base-4: 4
  base-5: 5
  base-6: 6
  dropdown: 10
  dropdown-high: 15
```