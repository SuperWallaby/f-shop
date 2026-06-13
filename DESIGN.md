---
version: alpha
name: Faséa Studio
<<<<<<< HEAD
description: Pilates studio + booking + shop — warm minimal, soft geometry, clay accent.
colors:
  primary: "#A66A4A"
  onPrimary: "#FFFFFF"
  secondary: "#716D64"
  tertiary: "#444444"
  canvas: "#FAF8F6"
  surface: "#FFFFFF"
  surfaceMuted: "#FFFCFA"
  border: "#E8DDD4"
  borderStrong: "#D4C4BA"
  tonalButton: "#DFD1C9"
  focusRing: "#DFD1C9"
  whatsapp: "#25D366"
  error: "#B42318"
  errorSurface: "#FCE8E6"
typography:
  display:
    fontFamily: serif
    fontSize: 28px
    fontWeight: "700"
    lineHeight: 1.2
  headline:
    fontFamily: sans-serif
    fontSize: 22px
    fontWeight: "600"
    lineHeight: 1.25
  title:
    fontFamily: sans-serif
    fontSize: 20px
    fontWeight: "600"
    lineHeight: 1.3
  body:
    fontFamily: sans-serif
    fontSize: 14px
    fontWeight: "400"
    lineHeight: 1.45
  label:
    fontFamily: sans-serif
    fontSize: 11px
    fontWeight: "500"
    lineHeight: 1.3
    letterSpacing: "0.02em"
  creditDisplay:
    fontFamily: serif
    fontSize: 28px
    fontWeight: "700"
    lineHeight: 1.15
rounded:
  sm: 12px
  md: 16px
  lg: 24px
  full: 9999px
=======
description: Pilates studio + booking — warm editorial wellness, soft geometry, clay accent.
source:
  format: https://github.com/google-labs-code/design.md
  adaptedFrom:
    - "google-labs-code/design.md — Heritage (warm limestone + clay accent)"
    - "rohitg00/awesome-claude-design — Warm Editorial (terracotta-on-cream)"
colors:
  canvas: "#FAF8F6"
  surface: "#FFFFFF"
  surfaceMuted: "#FFFCFA"
  onSurface: "#444444"
  onSurfaceVariant: "#716D64"
  accent: "#A66A4A"
  onAccent: "#FFFFFF"
  tonal: "#DFD1C9"
  onTonal: "#444444"
  border: "#E8DDD4"
  borderStrong: "#D1B9B4"
  cta: "#716D64"
  onCta: "#FFFFFF"
  gradientStart: "#FAF8F6"
  gradientMid: "#DFD1C9"
  gradientEnd: "#D1B9B4"
  whatsapp: "#25D366"
  error: "#B42318"
  errorSurface: "#FCE8E6"
  focusRing: "#DFD1C9"
typography:
  display:
    fontFamily: Playfair Display
    fontSize: 48px
    fontWeight: "700"
    lineHeight: 1.15
    letterSpacing: -0.01em
  headline:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: "700"
    lineHeight: 1.2
  title:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: "600"
    lineHeight: 1.3
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: "400"
    lineHeight: 1.6
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: "400"
    lineHeight: 1.6
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: "400"
    lineHeight: 1.5
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: "500"
    lineHeight: 1.25
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: "500"
    lineHeight: 1.2
    letterSpacing: 0.02em
rounded:
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  pill: 9999px
>>>>>>> main
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
<<<<<<< HEAD
  gutter: 18px
components:
  card:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.border}"
    rounded: "{rounded.lg}"
    padding: "{spacing.gutter}"
  filledButton:
    backgroundColor: "{colors.tonalButton}"
    textColor: "{colors.tertiary}"
    rounded: "{rounded.full}"
  filledButtonAccent:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.onPrimary}"
    rounded: "{rounded.full}"
  textField:
    fillColor: "{colors.surface}"
    borderColor: "{colors.border}"
    rounded: "{rounded.md}"
    focusColor: "{colors.focusRing}"
---

# Faséa — Design system (DESIGN.md)

Single-file design truth for **fasea.studio** (web) and the **Faséa Flutter app** (`apps/mobile`).  
Spec format: [google-labs-code/design.md](https://github.com/google-labs-code/design.md) (YAML tokens + markdown guidance).

## Overview

Faséa is a **warm, calm, studio-first** brand: lots of **cream and clay**, soft cards, one **terracotta accent** for trust and action. The product mixes **schedule booking**, **credits / membership**, and **light commerce links** — UI should feel **approachable**, not clinical or neon.

- **Voice:** quiet confidence, friendly copy, no shouty promos in chrome.
- **Density:** comfortable; prefer **24px card radius** and generous padding over tight grids.
- **Motion:** subtle; avoid aggressive parallax on core booking flows.

## Colors

- **Primary (`#A66A4A`):** Terracotta — primary actions, key emphasis, brand moments. Use **once per screen** for the main CTA when possible.
- **Secondary (`#716D64`):** Warm gray — secondary text, hints, nav labels.
- **Tertiary (`#444444`):** Body emphasis, titles on light surfaces.
- **Canvas (`#FAF8F6`):** Page / scaffold background (not pure white).
- **Surface (`#FFFFFF`):** Cards, sheets, inputs.
- **Border (`#E8DDD4`):** Default strokes; pair with **Tonal button** for filled neutral actions.
- **Tonal button (`#DFD1C9`):** Default filled buttons (matches web “clay pill” actions).
- **Error:** Use `error` + `errorSurface` for destructive or validation states only.

## Typography

- **Display / credit numbers:** `serif` (platform default serif — e.g. Playfair on web; app uses `fontFamily: serif` for hero numerics).
- **Headlines & UI chrome:** Material / system UI sans (Inter on web via CSS variables).
- Avoid more than **two weights** on one screen when possible (e.g. 600 + 400).

## Layout

- Spacing rhythm: **8px base** (see `spacing` tokens); cards use **`gutter` (18px)** internal padding aligned with Flutter `FaseaCard`.
- Mobile: single column; preserve **bottom safe areas** for toasts / CTAs.

## Elevation & Depth

- Prefer **soft border + slight fill** over heavy shadows.
- Shadows, if used: warm brown at low opacity (see app `FaseaCard` / web `shadow-sm`).

## Shapes

- **Cards:** `rounded.lg` (24px).
- **Inputs / small tiles:** `rounded.md` (16px).
- **Pills / primary actions:** `rounded.full`.

## Components

- **Cards:** White / translucent white on canvas, `#E8DDD4` outline, no harsh drop shadow.
- **Primary CTA:** Tonal clay fill + dark text; reserve **accent fill** (`primary`) for “Pay / Confirm / Danger” pathways as needed.
- **Links:** Underline sparingly; prefer pill buttons on mobile.

## Do's and Don'ts

- Do keep **WCAG AA** contrast for body text on `canvas` and `surface`.
- Do use **one** strong accent (primary) per view for the main action.
- Don’t use **pure black** (`#000`) for copy — use `tertiary` or `secondary`.
- Don’t mix **sharp 4px** corners with **24px** cards in the same screen without intent.
- Don’t mirror **Olive Young** or third-party marks; use original badges only.

---

*Implementation: Web — **`src/app/globals.css`** exposes `--fasea-*` tokens and `@theme inline` maps them to Tailwind utilities (`bg-fasea-canvas`, `border-fasea-border`, `rounded-fasea-lg`, …). Mobile — `apps/mobile/lib/fasea_design_system.dart` via **`buildFaseaTheme()`**. Keep YAML, CSS, and Flutter in sync with the tokens above.*
=======
  gutter: 24px
  section: 96px
  pageY: 96px
components:
  button-primary:
    backgroundColor: "{colors.cta}"
    textColor: "{colors.onCta}"
    typography: "{typography.label-md}"
    rounded: "{rounded.pill}"
    padding: 12px 24px
  button-primary-hover:
    backgroundColor: "{colors.cta}"
    opacity: 0.9
  button-tonal:
    backgroundColor: "{colors.tonal}"
    textColor: "{colors.onTonal}"
    typography: "{typography.label-md}"
    rounded: "{rounded.pill}"
    padding: 12px 24px
  button-tonal-hover:
    filter: brightness(0.95)
  button-secondary:
    backgroundColor: "rgba(255, 255, 255, 0.8)"
    textColor: "{colors.onSurface}"
    borderColor: "{colors.border}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.pill}"
    padding: 8px 16px
  button-secondary-hover:
    boxShadow: "0 1px 3px rgba(78, 56, 48, 0.08)"
  card:
    backgroundColor: "rgba(255, 255, 255, 0.7)"
    borderColor: "{colors.border}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  card-inner:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.border}"
    rounded: "{rounded.md}"
    padding: 20px
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.onSurface}"
    borderColor: "{colors.border}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: 12px 16px
    focusRing: "{colors.focusRing}"
  slot-selected:
    ringColor: "{colors.accent}"
    ringOffset: "{colors.canvas}"
  chip-active:
    backgroundColor: "{colors.tonal}"
    borderColor: "{colors.tonal}"
    textColor: "{colors.onSurface}"
  chip-default:
    backgroundColor: "rgba(255, 255, 255, 0.8)"
    borderColor: "{colors.border}"
    textColor: "{colors.onSurface}"
---

# Faséa Studio Design System

## Overview

Faséa is a **warm editorial wellness** brand — calm, tactile, and deliberately un-tech. The UI should feel like a quiet pilates studio: soft cream walls, clay accents, generous breathing room, and serif headlines that carry grace without luxury-brand coldness.

This file adapts two public references to match the live Faséa product:

- [Google DESIGN.md — Heritage pattern](https://github.com/google-labs-code/design.md) (warm limestone + single clay accent)
- [awesome-claude-design — Warm Editorial](https://github.com/rohitg00/awesome-claude-design/blob/main/design-md/warm/claude.md) (terracotta-on-cream, flat surfaces, typographic depth)

Token values below are aligned with the current web app (`#FAF8F6`, `#A66A4A`, `#DFD1C9`, Playfair + Inter).

## Colors

The palette is rooted in **warm neutrals** and a single **clay accent**. No cool blue-grays. No purple gradients.

- **Canvas (#FAF8F6):** Page background — warm off-white, softer than pure white. The emotional foundation.
- **Surface (#FFFFFF):** Cards and inputs. Often at 70–80% opacity over canvas for a layered, airy feel.
- **On-surface (#444444):** Primary text and headings (sans). Warm charcoal, never pure black.
- **On-surface variant (#716D64):** Captions, metadata, secondary labels, CTA button fill (`button-gradient`).
- **Accent (#A66A4A):** Clay terracotta — selection rings, calendar “today”, the single high-signal brand moment per view.
- **Tonal (#DFD1C9):** Primary filled actions on booking/admin flows, chip active state, focus rings, day-picker accent wash.
- **Border (#E8DDD4):** Default containment — cards, inputs, dividers.
- **Border strong (#D1B9B4):** Pill borders, subtle hover accents, hero gradient endpoint.
- **Gradient (FAF8F6 → DFD1C9 → D1B9B4):** Hero background only. Slow animated drift; do not reuse on dense forms.

Rules from Warm Editorial: **one accent moment per viewport**. Clay never competes with itself. Never tint body text with accent.

## Typography

**Serif for presence, sans for utility.**

- **Display / headlines:** `Playfair Display` at weight 700. Hero and section titles. Tight but breathable line-height (1.15–1.2).
- **Body / UI:** `Inter` at 400–600. Booking forms, admin tables, navigation, buttons.
- **Labels:** Inter 500 at 12–14px for chips, booking codes, slot metadata.

Do not use more than two families per screen. Do not default every surface to the same weight.

## Layout

- **App shells:** max-width content centered; booking/admin use `px-6 py-24` page rhythm.
- **Long-form (about):** generous `space-y-20` section breaks (~80–96px).
- **Grid rhythm:** 8px base; cards use 24px internal padding (`gutter`).
- **Whitespace:** let empty space carry calm. Avoid crowding slot grids or form fields.

## Elevation & Depth

**Flat by default.** Depth comes from:

- Surface color shifts (white/70 on `#FAF8F6`)
- 1px `{colors.border}` lines
- Type weight contrast

Allowed shadows: `shadow-sm` on cards and secondary buttons only. No heavy drop shadows. No glassmorphism. No neon glows.

## Shapes

**Soft geometry** — approachable, studio-like.

- **Pill buttons:** `rounded-full` for CTAs, back links, copy actions.
- **Cards:** `rounded-3xl` (24px) outer sections; `rounded-2xl` (16px) inner panels and inputs.
- **Selection:** accent ring with 2px offset on canvas for slot pickers.

Do not mix sharp 4px corners with pills on the same view.

## Components

### Buttons

- **Primary CTA:** `{colors.cta}` fill (`#716D64`), white text, pill shape. Used on marketing hero (Insta/WhatsApp). Hover: opacity 0.9, optional slight scale on marketing only.
- **Tonal:** `{colors.tonal}` fill for booking confirm, admin actions. Hover: `brightness(0.95)`.
- **Secondary:** white/80 + `{colors.border}` outline, pill. Hover: light shadow.

### Cards & sections

Outer sections: `bg-white/70`, `{colors.border}`, `rounded-3xl`, `shadow-sm`. Inner rows: solid white or white/50 with `{rounded.md}`.

### Inputs & slots

Inputs: white fill, `{colors.border}`, focus ring `{colors.focusRing}`. Slot buttons: white/80 default; selected state uses `{colors.accent}` ring; full slots are muted on canvas with reduced opacity.

### Calendar (react-day-picker)

Override defaults — no blue. Accent `{colors.onSurfaceVariant}`, today `{colors.accent}`, range wash `{colors.tonal}`.

## Do's and Don'ts

**Do**

- Use Playfair for marketing headlines; Inter for booking/admin UI.
- Keep one clay (`#A66A4A`) highlight per screen.
- Prefer tonal (`#DFD1C9`) fills for in-flow actions.
- Maintain WCAG AA contrast for body text on canvas and cards.

**Don't**

- Use purple-to-pink gradients or cool blue-grays.
- Apply accent clay to every button on a page.
- Add scale/lift hover on dense admin tables.
- Mix unrelated corner radii (sharp + pill) in one form.
- Use emoji in UI chrome.
>>>>>>> main
