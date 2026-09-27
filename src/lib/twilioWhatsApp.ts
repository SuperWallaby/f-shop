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
  bookingConfirmedEn: "HX41c592b37b25f875363c76b656c89f2a",
  bookingReminderEn: "HXbd3d4b12be0f97c148b29f507caeea51",
  bookingCancelledByClientEn: "HX8d36e7d55ed2e0d23289c39e1cd1b8af",
  classCancelledByInstructorEn: "HXc806a82664a071ec81ac69659dce0a18",
  noShowEn: "HXd82ce8413fd712391c3635e540bf5444",
  bookingRescheduledEn: "HXb71c254fe8b8019177063b0d70ce5e46",
  studioAlertEn: "HX9085d4dcb7b3dbd4184f486e05bedc19",
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
    `Reference: https://fasea.studio/info/booking`;

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

export async function sendBookingRescheduledWhatsApp(args: {
  to: string;
  body: string;
  dateKey: string;
  startMin: number;
  endMin: number;
  businessTimeZone: string;
}) {
  let sid = getContentSid("TWILIO_CONTENT_SID_BOOKING_RESCHEDULED_EN");
  if (!sid) sid = DEFAULT_CONTENT_SIDS.bookingRescheduledEn;
  if (!sid) {
    await sendTwilioWhatsApp({ to: args.to, body: args.body });
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
    contentVariables: { "1": dateLabel, "2": timeLabel },
  });
}

/**
 * Studio/admin alert. Uses an approved template because the admin number
 * rarely has an open 24h WhatsApp session (free-form bodies fail with 63016).
 */
export async function sendStudioAlertWhatsApp(args: {
  to: string;
  type: string;
  classLabel?: string;
  whenLabel?: string;
  clientLabel?: string;
  fallbackBody: string;
}) {
  let sid = getContentSid("TWILIO_CONTENT_SID_STUDIO_ALERT_EN");
  if (!sid) sid = DEFAULT_CONTENT_SIDS.studioAlertEn;
  if (!sid) {
    await sendTwilioWhatsApp({ to: args.to, body: args.fallbackBody });
    return;
  }

  await sendTwilioWhatsAppTemplate({
    to: args.to,
    contentSid: sid,
    contentVariables: {
      "1": args.type || "-",
      "2": args.classLabel || "-",
      "3": args.whenLabel || "-",
      "4": args.clientLabel || "-",
    },
  });
}

const ADMIN_KIND_LABELS = {
  booking_confirmed: "New booking",
  booking_cancelled_by_client: "Booking cancelled (client)",
  booking_rescheduled: "Booking rescheduled",
  class_cancelled_by_instructor: "Class cancelled (instructor)",
  reminder_sent: "Reminder job",
  no_show_marked: "No-show marked",
} as const;

export async function sendAdminWhatsAppNotification(args: {
  kind: keyof typeof ADMIN_KIND_LABELS;
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

  let whenLabel: string | undefined;
  if (
    args.dateKey &&
    args.startMin !== undefined &&
    args.endMin !== undefined &&
    args.businessTimeZone
  ) {
    const { dateLabel, timeRangeLabel } = formatKlParts({
      dateKey: args.dateKey,
      startMin: args.startMin,
      endMin: args.endMin,
      tz: args.businessTimeZone,
    });
    whenLabel = `${dateLabel} ${timeRangeLabel}`;
  }

  const type = [ADMIN_KIND_LABELS[args.kind], args.bookingCode]
    .filter(Boolean)
    .join(" · ");
  const clientLabel =
    [args.name, args.whatsapp].filter(Boolean).join(" · ") ||
    args.extra ||
    undefined;

  await sendStudioAlertWhatsApp({
    to,
    type,
    classLabel: args.classTypeName,
    whenLabel,
    clientLabel,
    fallbackBody: buildAdminBookingMessage({
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

