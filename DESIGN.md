---
version: alpha
name: Faséa Studio
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
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
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

_Implementation: Web — **`src/app/globals.css`** exposes `--fasea-_`tokens and`@theme inline` maps them to Tailwind utilities (`bg-fasea-canvas`, `border-fasea-border`, `rounded-fasea-lg`, …). Mobile — `apps/mobile/lib/fasea_design_system.dart` via **`buildFaseaTheme()`\*_. Keep YAML, CSS, and Flutter in sync with the tokens above._
