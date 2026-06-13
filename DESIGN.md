---
version: alpha
name: Faséa Studio
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
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
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
