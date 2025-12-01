export type LeadChannel = "instagram" | "whatsapp";

export function trackLeadClick(channel: LeadChannel, source?: string) {
 if (typeof window === "undefined") {
  return;
 }

 const anyWindow = window as unknown as {
  gtag?: (...args: unknown[]) => void;
 };

 if (!anyWindow.gtag) {
  return;
 }

 const eventParams: Record<string, unknown> = {
  event_category: "lead",
  channel,
 };

 if (source) {
  eventParams.source = source;
  eventParams.event_label = `${channel}_${source}`;
 } else {
  eventParams.event_label = channel;
 }

 anyWindow.gtag("event", "lead_click", eventParams);

 anyWindow.gtag("event", "conversion", {
  send_to: "AW-17771629817/egIFCNb_-ckbEPmZlppC",
 });
}
