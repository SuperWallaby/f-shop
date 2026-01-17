import { requireEnv, optionalEnv } from "@/lib/env";
import {
  buildAdminBookingMessage,
  buildCustomerBookingConfirmationMessage,
  buildCustomerCancelledByClientMessage,
  buildCustomerCancelledByInstructorMessage,
  buildCustomerReminderMessage,
  formatKlParts,
} from "@/lib/bookingMessages";

const DEFAULT_CONTENT_SIDS = {
  bookingConfirmedEn: "HX8eb56c76730f61160facb74d91acd32a",
  bookingReminderEn: "HXaf5345bb90988367047251d07dcf7f36",
  bookingCancelledByClientEn: "HXde78c084556bb1672cf7f85d8d26e927",
  classCancelledByInstructorEn: "HXa1e64586469081388ed540d7c50f0269",
  noShowEn: "HXa1256393456f0496ca3679231572e00a",
} as const;

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

export async function sendTwilioWhatsAppTemplate(args: {
  to: string; // E.164, without whatsapp:
  contentSid: string; // HX...
  contentVariables: Record<string, string>;
}): Promise<{ sid: string }> {
  const accountSid = requireEnv("TWILIO_ACCOUNT_SID");
  const authToken = requireEnv("TWILIO_AUTH_TOKEN");
  const from = requireEnv("TWILIO_WHATSAPP_FROM");
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
      ContentSid: args.contentSid,
      ContentVariables: JSON.stringify(args.contentVariables),
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

function getContentSid(name: string): string | undefined {
  const sid = optionalEnv(name);
  if (!sid) {
    return undefined;
  }
  return sid;
}

export async function sendBookingConfirmedWhatsApp(args: {
  to: string;
  name: string;
  classTypeName: string;
  bookingCode?: string;
  dateKey: string;
  startMin: number;
  endMin: number;
  businessTimeZone: string;
}) {
  let sid = getContentSid("TWILIO_CONTENT_SID_BOOKING_CONFIRMED_EN");
  if (!sid) sid = DEFAULT_CONTENT_SIDS.bookingConfirmedEn;
  const body = buildCustomerBookingConfirmationMessage({
    name: args.name,
    classTypeName: args.classTypeName,
    bookingCode: args.bookingCode,
    dateKey: args.dateKey,
    startMin: args.startMin,
    endMin: args.endMin,
    tz: args.businessTimeZone,
  });

  if (!sid) {
    await sendTwilioWhatsApp({ to: args.to, body });
    return;
  }

  const { dateLabel, timeLabel } = formatKlParts({
    dateKey: args.dateKey,
    startMin: args.startMin,
    endMin: args.endMin,
    tz: args.businessTimeZone,
  });

  await sendTwilioWhatsAppTemplate({
    to: args.to,
    contentSid: sid,
    contentVariables: {
      // v7 template:
      //  {{1}} date label
      //  {{2}} time label
      "1": dateLabel,
      "2": timeLabel,
    },
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
  let sid = getContentSid("TWILIO_CONTENT_SID_BOOKING_CANCELLED_BY_CLIENT_EN");
  if (!sid) sid = DEFAULT_CONTENT_SIDS.bookingCancelledByClientEn;
  const body = buildCustomerCancelledByClientMessage({
    name: args.name,
    classTypeName: args.classTypeName,
    dateKey: args.dateKey,
    startMin: args.startMin,
    endMin: args.endMin,
    tz: args.businessTimeZone,
  });

  if (!sid) {
    await sendTwilioWhatsApp({ to: args.to, body });
    return;
  }

  const { dateLabel, timeLabel } = formatKlParts({
    dateKey: args.dateKey,
    startMin: args.startMin,
    endMin: args.endMin,
    tz: args.businessTimeZone,
  });

  await sendTwilioWhatsAppTemplate({
    to: args.to,
    contentSid: sid,
    contentVariables: {
      // v7 template:
      //  {{1}} date label
      //  {{2}} time label
      "1": dateLabel,
      "2": timeLabel,
    },
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
  let sid = getContentSid("TWILIO_CONTENT_SID_CLASS_CANCELLED_BY_INSTRUCTOR_EN");
  if (!sid) sid = DEFAULT_CONTENT_SIDS.classCancelledByInstructorEn;
  const body = buildCustomerCancelledByInstructorMessage({
    classTypeName: args.classTypeName,
    dateKey: args.dateKey,
    startMin: args.startMin,
    endMin: args.endMin,
    tz: args.businessTimeZone,
  });

  if (!sid) {
    await sendTwilioWhatsApp({ to: args.to, body });
    return;
  }

  const { dateLabel, timeLabel } = formatKlParts({
    dateKey: args.dateKey,
    startMin: args.startMin,
    endMin: args.endMin,
    tz: args.businessTimeZone,
  });

  await sendTwilioWhatsAppTemplate({
    to: args.to,
    contentSid: sid,
    contentVariables: {
      // v7 template:
      //  {{1}} date label
      //  {{2}} time label
      "1": dateLabel,
      "2": timeLabel,
    },
  });
}

export async function sendBookingReminderWhatsApp(args: {
  to: string;
  dateKey: string;
  startMin: number;
  endMin: number;
  businessTimeZone: string;
}) {
  let sid = getContentSid("TWILIO_CONTENT_SID_BOOKING_REMINDER_EN");
  if (!sid) sid = DEFAULT_CONTENT_SIDS.bookingReminderEn;
  const body = buildCustomerReminderMessage({
    dateKey: args.dateKey,
    startMin: args.startMin,
    endMin: args.endMin,
    tz: args.businessTimeZone,
  });

  if (!sid) {
    await sendTwilioWhatsApp({ to: args.to, body });
    return;
  }

  const { dateLabel, timeLabel } = formatKlParts({
    dateKey: args.dateKey,
    startMin: args.startMin,
    endMin: args.endMin,
    tz: args.businessTimeZone,
  });

  await sendTwilioWhatsAppTemplate({
    to: args.to,
    contentSid: sid,
    contentVariables: {
      "1": dateLabel,
      "2": timeLabel,
    },
  });
}

export async function sendNoShowWhatsApp(args: {
  to: string;
  classTypeName: string;
  dateKey: string;
  startMin: number;
  endMin: number;
  businessTimeZone: string;
}) {
  let sid = getContentSid("TWILIO_CONTENT_SID_NO_SHOW_EN");
  if (!sid) sid = DEFAULT_CONTENT_SIDS.noShowEn;

  const { dateLabel, timeLabel } = formatKlParts({
    dateKey: args.dateKey,
    startMin: args.startMin,
    endMin: args.endMin,
    tz: args.businessTimeZone,
  });

  const body =
    `Booking status update: attendance not recorded.\n` +
    `Date: ${dateLabel}\n` +
    `Time: ${timeLabel}\n\n` +
    `Reference: https://fasea.plantweb.io/info/booking`;

  if (!sid) {
    await sendTwilioWhatsApp({ to: args.to, body });
    return;
  }

  await sendTwilioWhatsAppTemplate({
    to: args.to,
    contentSid: sid,
    contentVariables: {
      // v7 template:
      //  {{1}} date label
      //  {{2}} time label
      "1": dateLabel,
      "2": timeLabel,
    },
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

