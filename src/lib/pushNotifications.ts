import {
  cert,
  getApp,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

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
): Promise<{ sent: number; failed: number }> {
  const unique = [...new Set(tokens.map((t) => t.trim()).filter(Boolean))];
  if (unique.length === 0) return { sent: 0, failed: 0 };
  if (!ensureFirebaseAdmin()) return { sent: 0, failed: unique.length };

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

  return {
    sent: res.successCount,
    failed: res.failureCount,
  };
}

export async function sendBookingConfirmedPush(args: {
  tokens: string[];
  className: string;
  bookingCode: string;
  dateLabel: string;
  timeLabel: string;
}) {
  return sendPushToTokens(args.tokens, {
    title: "Booking confirmed",
    body: `${args.className} · ${args.dateLabel} ${args.timeLabel}`,
    data: {
      type: "booking_confirmed",
      code: args.bookingCode,
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
