/** Local dev ports — mirror `.env.local` (FASEA_WEB_PORT / FASEA_API_PORT). */
export const FASEA_DEV_WEB_PORT = process.env.FASEA_WEB_PORT ?? "7357";
export const FASEA_DEV_API_PORT =
  process.env.FASEA_API_PORT ?? process.env.PORT ?? "4819";

export function faseaDevOriginPorts(): string[] {
  return [...new Set([FASEA_DEV_WEB_PORT, FASEA_DEV_API_PORT])];
}
