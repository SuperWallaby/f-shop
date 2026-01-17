export const PASTEL_PALETTE = [
  "#F6D6D8", // rose
  "#F9E1C7", // peach
  "#F7F2C6", // butter
  "#DFF3D6", // mint
  "#D6F2EE", // aqua
  "#D7E9FF", // sky
  "#E1D9FF", // lavender
  "#F2D7FF", // lilac
  "#F8D6EC", // pink
  "#E9E4D8", // sand
  "#DDE8E8", // fog
  "#E5F0D8", // sage
  "#D9F1E2", // seafoam
  "#D9E3F9", // periwinkle
  "#E9D7F2", // mauve
  "#F3D9D1", // coral-sand
  "#E6E2C9", // oat
  "#DCE6D8", // olive-mist
  "#DCE0EA", // slate-mist
  "#EFE0D8", // blush-sand
];

export function normalizeHexColor(input: string): string | null {
  const s = (input ?? "").trim();
  if (!s) return null;
  const raw = s.startsWith("#") ? s.slice(1) : s;
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return null;
  return `#${raw.toLowerCase()}`;
}

export function pickUnusedPastelRandom(
  existingColors: Iterable<string>,
  opts?: { avoid?: string | null }
): string {
  const avoid = normalizeHexColor(opts?.avoid ?? "") ?? null;
  const used = new Set<string>(
    Array.from(existingColors)
      .map((c) => normalizeHexColor(c))
      .filter(Boolean) as string[]
  );
  if (avoid) used.add(avoid);

  const unusedPalette = PASTEL_PALETTE.map((c) => normalizeHexColor(c)!).filter(
    (c) => !used.has(c)
  );
  if (unusedPalette.length > 0) {
    const idx = Math.floor(Math.random() * unusedPalette.length);
    return unusedPalette[idx];
  }

  // Fallback: generate pastel hues spread by golden angle; keep it light.
  const golden = 137.50776405003785;
  const offset = Math.random() * 360;
  for (let i = 0; i < 400; i++) {
    const h = (offset + i * golden) % 360;
    const c = hslToHex(h, 0.55, 0.88);
    const n = normalizeHexColor(c)!;
    if (!used.has(n)) return n;
  }

  return "#e9e4d8";
}

function hslToHex(h: number, s: number, l: number): string {
  // h: 0..360, s/l: 0..1
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (h % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0,
    g = 0,
    b = 0;
  if (hp >= 0 && hp < 1) [r, g, b] = [c, x, 0];
  else if (hp >= 1 && hp < 2) [r, g, b] = [x, c, 0];
  else if (hp >= 2 && hp < 3) [r, g, b] = [0, c, x];
  else if (hp >= 3 && hp < 4) [r, g, b] = [0, x, c];
  else if (hp >= 4 && hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function pickUnusedPastel(existingColors: Iterable<string>): string {
  const used = new Set<string>(
    Array.from(existingColors)
      .map((c) => normalizeHexColor(c))
      .filter(Boolean) as string[]
  );

  for (const c of PASTEL_PALETTE) {
    const n = normalizeHexColor(c)!;
    if (!used.has(n)) return n;
  }

  // Fallback: generate pastel hues spread by golden angle; keep it light.
  const golden = 137.50776405003785;
  for (let i = 0; i < 200; i++) {
    const h = (i * golden) % 360;
    const c = hslToHex(h, 0.55, 0.88);
    const n = normalizeHexColor(c)!;
    if (!used.has(n)) return n;
  }

  // Worst-case fallback
  return "#e9e4d8";
}

