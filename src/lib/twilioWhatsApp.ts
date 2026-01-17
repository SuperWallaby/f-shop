import { requireEnv, optionalEnv } from "@/lib/env";
import {
  buildAdminBookingMessage,
  buildCustomerBookingConfirmationMessage,
  buildCustomerCancelledByClientMessage,
  buildCustomerCancelledByInstructorMessage,
  buildCustomerNoShowMessage,
  buildCustomerReminderMessage,
  formatKlParts,
} from "@/lib/bookingMessages";

const DEFAULT_CONTENT_SIDS = {
  bookingConfirmedEn: "HXce558372a44f944ac213a7385aa9b553",
  bookingReminderEn: "HX6616d80554e9e2b81ade282422a24171",
  bookingCancelledByClientEn: "HXca89227a701fd1aeda632b4d828ff108",
  classCancelledByInstructorEn: "HX4a429a962f13b4f5d6711e8c5883682d",
  noShowFirstTimerEn: "HX2bcccf411ddaf73d1640e3f6d6ff4e8f",
  noShowEn: "HXd31e3e399d44810bd67b4713d54550a4",
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
      "1": args.name,
      "2": args.classTypeName,
      "3": dateLabel,
      "4": timeLabel,
      "5": args.bookingCode ?? "",
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
      "1": args.name,
      "2": args.classTypeName,
      "3": dateLabel,
      "4": timeLabel,
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
      "1": dateLabel,
      "2": timeLabel,
      "3": args.classTypeName,
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
  name: string;
  firstTimer: boolean;
}) {
  const body = buildCustomerNoShowMessage({
    name: args.name,
    firstTimer: args.firstTimer,
  });

  let sid: string | undefined;
  if (args.firstTimer) {
    sid = getContentSid("TWILIO_CONTENT_SID_NO_SHOW_FIRST_TIMER_EN");
    if (!sid) sid = DEFAULT_CONTENT_SIDS.noShowFirstTimerEn;
  } else {
    sid = getContentSid("TWILIO_CONTENT_SID_NO_SHOW_EN");
    if (!sid) sid = DEFAULT_CONTENT_SIDS.noShowEn;
  }

  if (!sid) {
    await sendTwilioWhatsApp({ to: args.to, body });
    return;
  }

  await sendTwilioWhatsAppTemplate({
    to: args.to,
    contentSid: sid,
    contentVariables: {
      "1": args.name,
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

