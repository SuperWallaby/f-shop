import { NextRequest } from "next/server";
import { getCollections } from "@/lib/db";
import { jsonError, jsonOk } from "../../_utils/http";
import { requireAdmin } from "../../_utils/adminAuth";
import { adminUpdateSettingsSchema } from "@/lib/schemas";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";
import { DEFAULT_BOOKING_RULES } from "@/lib/bookingRules";
import type { SettingsDoc } from "@/lib/db";

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth) return auth;

  try {
    const { settings } = await getCollections();
    const existing = await settings.findOne({ _id: "singleton" });
    if (existing) {
      return jsonOk(existing);
    }
    const now = new Date();
    const doc = {
      _id: "singleton" as const,
      businessTimeZone: BUSINESS_TIME_ZONE,
      weeklyPattern: {},
      bookingRules: DEFAULT_BOOKING_RULES,
      updatedAt: now,
    };
    await settings.insertOne(doc);
    return jsonOk(doc);
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}

export async function PUT(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth) return auth;

  try {
    const body = await req.json().catch(() => null);
    const parsed = adminUpdateSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid body", 400, parsed.error.flatten());
    }

    const { settings, settingsHistory } = await getCollections();
    const existing = await settings.findOne({ _id: "singleton" });

    const countPattern = (p: unknown): number => {
      if (!p || typeof p !== "object") return 0;
      let total = 0;
      for (const v of Object.values(p as Record<string, unknown>)) {
        if (Array.isArray(v)) total += v.length;
      }
      return total;
    };

    const existingCount = countPattern((existing as { weeklyPattern?: unknown } | null)?.weeklyPattern);
    const nextCount = countPattern(parsed.data.weeklyPattern);
    if (nextCount === 0 && existingCount > 0 && !parsed.data.confirmEmptyWeeklyPattern) {
      return jsonError(
        "Refusing to overwrite Weekly pattern with an empty value. Reload settings and try again, or confirm reset.",
        409
      );
    }

    const now = new Date();
    await settings.updateOne(
      { _id: "singleton" },
      {
        $set: {
          weeklyPattern: parsed.data.weeklyPattern,
          businessTimeZone: BUSINESS_TIME_ZONE,
          bookingRules: parsed.data.bookingRules ?? DEFAULT_BOOKING_RULES,
          updatedAt: now,
        },
        $setOnInsert: { _id: "singleton" },
      },
      { upsert: true }
    );
    const updated = await settings.findOne({ _id: "singleton" });
    if (!updated) {
      return jsonError("Failed to load updated settings", 500);
    }

    // History record (best-effort): store prev/next snapshots for audit + recovery.
    try {
      await settingsHistory.insertOne({
        settingsId: "singleton",
        createdAt: now,
        prev: (existing as SettingsDoc | null) ?? null,
        next: updated as SettingsDoc,
      });
    } catch {
      // ignore
    }

    return jsonOk(updated);
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}

