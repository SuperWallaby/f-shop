import { ObjectId } from "mongodb";
import {
  cert,
  getApp,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import {
  deleteInvalidPushTokens,
  listPushTokensForClient,
} from "@/lib/pushTokens";

type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

function ensureFirebaseAdmin(): App | null {
  if (getApps().length > 0) {
    return getApp();
  }
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  try {
    const cred = JSON.parse(raw) as ServiceAccount;
    return initializeApp({ credential: cert(cred) });
  } catch {
    return null;
  }
}

export function isPushConfigured(): boolean {
  return ensureFirebaseAdmin() != null;
}

export async function sendPushToTokens(
  tokens: string[],
  payload: PushPayload,
): Promise<{ sent: number; failed: number; invalidTokens: string[] }> {
  const unique = [...new Set(tokens.map((t) => t.trim()).filter(Boolean))];
  if (unique.length === 0) {
    return { sent: 0, failed: 0, invalidTokens: [] };
  }
  if (!ensureFirebaseAdmin()) {
    return { sent: 0, failed: unique.length, invalidTokens: [] };
  }

  const res = await getMessaging().sendEachForMulticast({
    tokens: unique,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: payload.data,
    apns: {
      payload: {
        aps: { sound: "default" },
      },
    },
    android: {
      priority: "high",
      notification: { sound: "default" },
    },
  });

  const invalidTokenCodes = new Set([
    "messaging/invalid-registration-token",
    "messaging/registration-token-not-registered",
  ]);
  const invalidTokens = res.responses.flatMap((response, index) =>
    !response.success &&
    response.error?.code &&
    invalidTokenCodes.has(response.error.code)
      ? [unique[index]!]
      : [],
  );
  return {
    sent: res.successCount,
    failed: res.failureCount,
    invalidTokens,
  };
}

/** Best-effort push to a client's registered devices. */
export async function notifyClientPush(
  clientId: ObjectId | null | undefined,
  payload: PushPayload,
): Promise<{ sent: number; failed: number }> {
  if (!clientId) return { sent: 0, failed: 0 };
  try {
    const tokens = await listPushTokensForClient(clientId);
    if (!tokens.length) return { sent: 0, failed: 0 };
    const result = await sendPushToTokens(tokens, payload);
    if (result.invalidTokens.length) {
      await deleteInvalidPushTokens(result.invalidTokens);
    }
    return { sent: result.sent, failed: result.failed };
  } catch {
    return { sent: 0, failed: 0 };
  }
}

export async function sendBookingConfirmedPush(args: {
  tokens?: string[];
  clientId?: ObjectId | null;
  className: string;
  bookingCode: string;
  dateLabel: string;
  timeLabel: string;
}) {
  const payload: PushPayload = {
    title: "Booking confirmed",
    body: `${args.className} · ${args.dateLabel} ${args.timeLabel}`,
    data: {
      type: "booking_confirmed",
      code: args.bookingCode,
    },
  };
  if (args.clientId) return notifyClientPush(args.clientId, payload);
  return sendPushToTokens(args.tokens ?? [], payload);
}

export async function sendBookingCancelledPush(args: {
  clientId?: ObjectId | null;
  className: string;
  bookingCode?: string;
  dateLabel: string;
  timeLabel: string;
}) {
  return notifyClientPush(args.clientId, {
    title: "Booking cancelled",
    body: `${args.className} · ${args.dateLabel} ${args.timeLabel}`,
    data: {
      type: "booking_cancelled",
      code: args.bookingCode ?? "",
    },
  });
}

export async function sendBookingRescheduledPush(args: {
  clientId?: ObjectId | null;
  className: string;
  bookingCode?: string;
  dateLabel: string;
  timeLabel: string;
}) {
  return notifyClientPush(args.clientId, {
    title: "Booking updated",
    body: `New time: ${args.className} · ${args.dateLabel} ${args.timeLabel}`,
    data: {
      type: "booking_rescheduled",
      code: args.bookingCode ?? "",
    },
  });
}

export async function sendClassCancelledPush(args: {
  clientId?: ObjectId | null;
  className: string;
  bookingCode?: string;
  dateLabel: string;
  timeLabel: string;
}) {
  return notifyClientPush(args.clientId, {
    title: "Class cancelled",
    body: `${args.className} on ${args.dateLabel} at ${args.timeLabel} was cancelled`,
    data: {
      type: "class_cancelled",
      code: args.bookingCode ?? "",
    },
  });
}

export async function sendClassChangedPush(args: {
  clientId?: ObjectId | null;
  className: string;
  bookingCode?: string;
  dateLabel: string;
  timeLabel: string;
}) {
  return notifyClientPush(args.clientId, {
    title: "Class time updated",
    body: `${args.className} is now ${args.dateLabel} ${args.timeLabel}`,
    data: {
      type: "class_changed",
      code: args.bookingCode ?? "",
    },
  });
}

export async function sendClassReminderPush(args: {
  tokens: string[];
  className: string;
  dateLabel: string;
  timeLabel: string;
  bookingCode: string;
}) {
  return sendPushToTokens(args.tokens, {
    title: "Class reminder",
    body: `Tomorrow: ${args.className} at ${args.timeLabel}`,
    data: {
      type: "class_reminder",
      code: args.bookingCode,
    },
  });
}
