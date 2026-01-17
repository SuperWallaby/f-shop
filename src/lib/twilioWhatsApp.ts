import { requireEnv, optionalEnv } from "@/lib/env";
import {
  buildAdminBookingMessage,
  buildCustomerBookingConfirmationMessage,
  buildCustomerCancelledByClientMessage,
  buildCustomerCancelledByInstructorMessage,
  buildCustomerNoShowMessage,
  buildCustomerReminderMessage,
} from "@/lib/bookingMessages";

function formEncode(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

export async function sendTwilioWhatsApp(args: {
  to: string; // E.164, e.g. +60123456789 (without whatsapp:)
  body: string;
}): Promise<{ sid: string }> {
  const accountSid = requireEnv("TWILIO_ACCOUNT_SID");
  const authToken = requireEnv("TWILIO_AUTH_TOKEN");
  const from = requireEnv("TWILIO_WHATSAPP_FROM"); // E.164, e.g. +14155238886
  const baseUrl =
    optionalEnv("TWILIO_API_BASE_URL") ?? "https://api.twilio.com";

  const url = `${baseUrl}/2010-04-01/Accounts/${encodeURIComponent(
    accountSid
  )}/Messages.json`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${accountSid}:${authToken}`,
        "utf8"
      ).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formEncode({
      From: `whatsapp:${from}`,
      To: `whatsapp:${args.to}`,
      Body: args.body,
    }),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      (json && typeof json === "object" && "message" in json
        ? String((json as { message?: unknown }).message)
        : null) ?? `Twilio error (${res.status})`
    );
  }

  const sid =
    (json && typeof json === "object" && "sid" in json
      ? String((json as { sid?: unknown }).sid)
      : "") || "";
  return { sid };
}

export function getAdminWhatsappTo(): string {
  return requireEnv("TWILIO_WHATSAPP_TO");
}

export async function sendBookingConfirmedWhatsApp(args: {
  to: string;
  name: string;
  classTypeName: string;
  dateKey: string;
  startMin: number;
  endMin: number;
  businessTimeZone: string;
}) {
  await sendTwilioWhatsApp({
    to: args.to,
    body: buildCustomerBookingConfirmationMessage({
      name: args.name,
      classTypeName: args.classTypeName,
      dateKey: args.dateKey,
      startMin: args.startMin,
      endMin: args.endMin,
      tz: args.businessTimeZone,
    }),
  });
}

export async function sendBookingCancelledByClientWhatsApp(args: {
  to: string;
  name: string;
  classTypeName: string;
  dateKey: string;
  startMin: number;
  endMin: number;
  businessTimeZone: string;
}) {
  await sendTwilioWhatsApp({
    to: args.to,
    body: buildCustomerCancelledByClientMessage({
      name: args.name,
      classTypeName: args.classTypeName,
      dateKey: args.dateKey,
      startMin: args.startMin,
      endMin: args.endMin,
      tz: args.businessTimeZone,
    }),
  });
}

export async function sendClassCancelledByInstructorWhatsApp(args: {
  to: string;
  classTypeName: string;
  dateKey: string;
  startMin: number;
  endMin: number;
  businessTimeZone: string;
}) {
  await sendTwilioWhatsApp({
    to: args.to,
    body: buildCustomerCancelledByInstructorMessage({
      classTypeName: args.classTypeName,
      dateKey: args.dateKey,
      startMin: args.startMin,
      endMin: args.endMin,
      tz: args.businessTimeZone,
    }),
  });
}

export async function sendBookingReminderWhatsApp(args: {
  to: string;
  dateKey: string;
  startMin: number;
  endMin: number;
  businessTimeZone: string;
}) {
  await sendTwilioWhatsApp({
    to: args.to,
    body: buildCustomerReminderMessage({
      dateKey: args.dateKey,
      startMin: args.startMin,
      endMin: args.endMin,
      tz: args.businessTimeZone,
    }),
  });
}

export async function sendNoShowWhatsApp(args: {
  to: string;
  name: string;
  firstTimer: boolean;
}) {
  await sendTwilioWhatsApp({
    to: args.to,
    body: buildCustomerNoShowMessage({
      name: args.name,
      firstTimer: args.firstTimer,
    }),
  });
}

export async function sendAdminWhatsAppNotification(args: {
  kind:
    | "booking_confirmed"
    | "booking_cancelled_by_client"
    | "class_cancelled_by_instructor"
    | "reminder_sent"
    | "no_show_marked";
  name?: string;
  email?: string;
  whatsapp?: string;
  bookingCode?: string;
  classTypeName?: string;
  dateKey?: string;
  startMin?: number;
  endMin?: number;
  businessTimeZone?: string;
  extra?: string;
}) {
  const to = optionalEnv("TWILIO_WHATSAPP_TO");
  if (!to) return;
  await sendTwilioWhatsApp({
    to,
    body: buildAdminBookingMessage({
      kind: args.kind,
      name: args.name,
      email: args.email,
      whatsapp: args.whatsapp,
      bookingCode: args.bookingCode,
      classTypeName: args.classTypeName,
      dateKey: args.dateKey,
      startMin: args.startMin,
      endMin: args.endMin,
      tz: args.businessTimeZone,
      extra: args.extra,
    }),
  });
}

