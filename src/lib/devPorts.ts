/** Local dev ports — mirror `.env.local` (FASEA_WEB_PORT / FASEA_API_PORT). */
export const FASEA_DEV_WEB_PORT = process.env.FASEA_WEB_PORT ?? "7357";
export const FASEA_DEV_API_PORT =
  process.env.FASEA_API_PORT ?? process.env.PORT ?? "4819";

export function faseaDevOriginPorts(): string[] {
  return [...new Set([FASEA_DEV_WEB_PORT, FASEA_DEV_API_PORT])];
}

function productionFlutterWebOrigins(): string[] {
  return (process.env.FASEA_FLUTTER_WEB_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Flutter web app origins allowed for CORS, OAuth return, and cross-origin cookies. */
export function resolveAllowedFlutterWebOrigin(raw: string): string | null {
  try {
    const url = new URL(raw);
    const origin = url.origin;

    if (process.env.NODE_ENV !== "production") {
      if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
        return null;
      }
      const port = url.port || (url.protocol === "https:" ? "443" : "80");
      if (new Set(faseaDevOriginPorts()).has(port)) {
        return origin;
      }
      return null;
    }

    if (productionFlutterWebOrigins().includes(origin)) {
      return origin;
    }
    return null;
  } catch {
    return null;
  }
}

export function isAllowedFlutterWebOrigin(origin: string): boolean {
  return resolveAllowedFlutterWebOrigin(origin) === origin;
}
