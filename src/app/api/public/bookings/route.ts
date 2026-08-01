import { NextRequest } from "next/server";
import { MongoServerError, ObjectId } from "mongodb";
import { getCollections } from "@/lib/db";
import { jsonError, jsonOk } from "../../_utils/http";
import { createBookingSchema } from "@/lib/schemas";
import { sendBookingCreatedEmail } from "@/lib/email";
import type { BookingDb } from "@/lib/db";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";
import { getBookingRulesFromSettings, isSlotBookableByRules } from "@/lib/bookingRules";
import { usesExclusiveTimeBlocking } from "@/lib/exclusiveBooking";
import { generateBookingCode6 } from "@/lib/bookingCode";
import { acquireExclusiveLocks } from "@/lib/exclusiveLocks";
import { sendAdminWhatsAppNotification, sendBookingConfirmedWhatsApp } from "@/lib/twilioWhatsApp";
import {
  backfillBookingConsumesForClient,
  insertBookingConsume,
  makeCustomerKey,
} from "@/lib/credits";
import { hashPassword } from "@/lib/password";
import { setClientSessionCookie } from "@/lib/clientSession";
import { getClientIdFromRequest } from "@/app/api/_utils/clientAuth";
import { findClientsByWhatsapp } from "@/lib/clientMerge";
import { clientWhatsappFields, normalizeWhatsapp } from "@/lib/whatsapp";
import {
  resolveOrCreateBookingClient,
  unlinkedBookingsMatchFilter,
} from "@/lib/resolveBookingClient";

class HttpError extends Error {
  status: number;
  details?: unknown;
  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = createBookingSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid body", 400, parsed.error.flatten());
    }

    const {
      slotId,
      name,
      email,
      whatsapp,
      consentWhatsapp,
      marketingOptIn,
      signUp,
      password,
    } = parsed.data;
    if (consentWhatsapp !== true) {
      return jsonError("Consent required", 400, {
        field: "consentWhatsapp",
        message:
          "Please agree to receive booking-related updates via WhatsApp.",
      });
    }
    if (signUp && !password) {
      return jsonError("Enter a 4-digit password to create an account.", 400);
    }

    const slotObjectId = ObjectId.isValid(slotId) ? new ObjectId(slotId) : null;
    if (!slotObjectId) return jsonError("Invalid slotId", 400);

    const {
      settings,
      timeSlots,
      bookings,
      items,
      exclusiveLocks,
      clients,
      creditLedger,
      orders,
    } = await getCollections();
    const now = new Date();

    const sessionClientId = getClientIdFromRequest(req);
    let linkedClientId: ObjectId | undefined = sessionClientId ?? undefined;

    let signupClientId: ObjectId | undefined;
    if (signUp && password) {
      const emailLower = email.trim().toLowerCase();
      const nameTrim = name.trim();
      const waFields = clientWhatsappFields(whatsapp);
      const waNorm = waFields?.whatsapp ?? normalizeWhatsapp(whatsapp);
      const existing = await clients.findOne({ email: emailLower });
      if (existing?.passwordHash) {
        return jsonError(
          "An account with this email already exists. Sign in instead, or book as a guest.",
          409,
        );
      }
      if (waNorm) {
        const waMatches = await findClientsByWhatsapp(clients, waNorm);
        const other = waMatches.find(
          (c) => !existing?._id || !c._id.equals(existing._id),
        );
        if (other) {
          return jsonError(
            "This WhatsApp number is already registered to another account. Sign in or recover that account, or book as a guest.",
            409,
            { code: "whatsapp_taken" },
          );
        }
      }
      const passwordHash = await hashPassword(password);
      if (existing) {
        await clients.updateOne(
          { _id: existing._id },
          {
            $set: {
              passwordHash,
              name: nameTrim || existing.name,
              whatsapp: waNorm,
              ...(waFields
                ? { whatsappDigits: waFields.whatsappDigits }
                : {}),
              updatedAt: now,
              lastLoginAt: now,
            },
          },
        );
        signupClientId = existing._id!;
      } else {
        try {
          const ins = await clients.insertOne({
            customerKey: makeCustomerKey({ email: emailLower }),
            name: nameTrim,
            email: emailLower,
            whatsapp: waNorm,
            ...(waFields
              ? { whatsappDigits: waFields.whatsappDigits }
              : {}),
            passwordHash,
            studentStatus: "none" as const,
            createdAt: now,
            updatedAt: now,
            lastLoginAt: now,
          });
          signupClientId = ins.insertedId;
        } catch (e) {
          if (e instanceof MongoServerError && e.code === 11000) {
            const msg = String(e.message ?? "");
            if (msg.includes("whatsappDigits")) {
              return jsonError(
                "This WhatsApp number is already registered. Sign in or recover that account, or book as a guest.",
                409,
                { code: "whatsapp_taken" },
              );
            }
            return jsonError(
              "An account with this email already exists. Sign in instead, or book as a guest.",
              409,
            );
          }
          throw e;
        }
      }
      linkedClientId = signupClientId;
    } else if (sessionClientId) {
      const sessionClient = await clients.findOne({ _id: sessionClientId });
      if (!sessionClient) {
        linkedClientId = undefined;
      }
    }

    const settingsDoc = await settings.findOne({ _id: "singleton" });
    const rules = getBookingRulesFromSettings(settingsDoc);

    const existingSlot = await timeSlots.findOne({ _id: slotObjectId });
    if (!existingSlot) return jsonError("Slot not found", 404);
    if (existingSlot.cancelled) return jsonError("Slot is cancelled", 409);

    const item = await items.findOne({ _id: existingSlot.itemId });
    if (!item || !item.active) return jsonError("Item not found or inactive", 409);
    const itemRef = item;
    const exclusiveKey = (itemRef.exclusiveKey ?? "").trim();
    const effectiveCapacity = itemRef.capacity;

    let insertedBuckets: number[] = [];
    if (exclusiveKey && usesExclusiveTimeBlocking(effectiveCapacity)) {
      // Back-compat + correctness: enforce overlap-based exclusivity even if locks are not yet seeded.
      const conflict = await bookings.findOne(
        {
          status: "confirmed",
          exclusiveKey,
          dateKey: existingSlot.dateKey,
          itemId: { $ne: itemRef._id },
          startMin: { $lt: existingSlot.endMin },
          endMin: { $gt: existingSlot.startMin },
        },
        { projection: { _id: 1 } },
      );
      if (conflict) return jsonError("This time is already booked", 409);

      const lockRes = await acquireExclusiveLocks({
        exclusiveLocks,
        exclusiveKey,
        dateKey: existingSlot.dateKey,
        itemId: itemRef._id!,
        startMin: existingSlot.startMin,
        endMin: existingSlot.endMin,
        now,
      });
      if (!lockRes.ok) {
        return jsonError("This time is already booked", 409);
      }
      insertedBuckets = lockRes.insertedBuckets;
    }

    const updatedSlot = await timeSlots.findOneAndUpdate(
      {
        _id: slotObjectId,
        cancelled: false,
        itemId: itemRef._id,
        $expr: { $lt: ["$bookedCount", effectiveCapacity] },
      },
      { $inc: { bookedCount: 1 }, $set: { updatedAt: now } },
      { returnDocument: "after" },
    );

    if (!updatedSlot) {
      if (exclusiveKey && insertedBuckets.length > 0) {
        await exclusiveLocks.deleteMany({
          exclusiveKey,
          dateKey: existingSlot.dateKey,
          itemId: itemRef._id!,
          bucket: { $in: insertedBuckets },
        });
      }
      return jsonError("Slot is full or unavailable", 409);
    }

    const slotRef = updatedSlot;

    async function rollbackSlotLocks() {
      await timeSlots.updateOne(
        { _id: slotRef._id, bookedCount: { $gt: 0 } },
        { $inc: { bookedCount: -1 }, $set: { updatedAt: new Date() } },
      );
      if (exclusiveKey && insertedBuckets.length > 0) {
        await exclusiveLocks.deleteMany({
          exclusiveKey,
          dateKey: slotRef.dateKey,
          itemId: itemRef._id!,
          bucket: { $in: insertedBuckets },
        });
      }
    }

    if (
      !isSlotBookableByRules({
        now,
        dateKey: slotRef.dateKey,
        startMin: slotRef.startMin,
        rules,
      })
    ) {
      await rollbackSlotLocks();
      return jsonError("This slot is not bookable anymore", 409);
    }

    const nameTrim = name.trim();
    const emailTrim = email.trim().toLowerCase();

    let whatsappNormalized = "";
    if (!linkedClientId) {
      // WhatsApp first, then email — same phone = same account.
      const resolved = await resolveOrCreateBookingClient({
        clients,
        bookings,
        creditLedger,
        orders,
        name: nameTrim,
        email: emailTrim,
        whatsapp,
        now,
        createIfMissing: true,
      });
      linkedClientId = resolved.clientId;
      whatsappNormalized = resolved.whatsappNormalized;
    } else {
      const waFields = whatsapp.trim()
        ? clientWhatsappFields(whatsapp.trim())
        : null;
      whatsappNormalized = waFields?.whatsapp || whatsapp;
      const linkFilter = unlinkedBookingsMatchFilter({
        email: emailTrim,
        whatsapp: whatsappNormalized,
      });
      if (linkFilter) {
        await bookings.updateMany(linkFilter, {
          $set: { clientId: linkedClientId },
        });
      }
      await backfillBookingConsumesForClient({
        bookings,
        creditLedger,
        clientId: linkedClientId,
        now,
        note: "Linked past booking",
      });
    }

    const bookingDoc: BookingDb = {
      code: generateBookingCode6(),
      slotId: slotRef._id,
      detached: false,
      itemId: itemRef._id,
      exclusiveKey: exclusiveKey || undefined,
      ...(linkedClientId ? { clientId: linkedClientId } : {}),
      name: nameTrim,
      email: emailTrim,
      whatsapp: whatsappNormalized || whatsapp,
      consentWhatsapp: true,
      ...(marketingOptIn
        ? { marketingOptIn: true, marketingOptInAt: now }
        : {}),
      status: "confirmed" as const,
      createdAt: now,
      dateKey: slotRef.dateKey,
      startMin: slotRef.startMin,
      endMin: slotRef.endMin,
      businessTimeZone: BUSINESS_TIME_ZONE,
      capacityAtBooking: effectiveCapacity,
    };

    let result: { insertedId: ObjectId } | null = null;
    try {
      for (let attempt = 0; attempt < 6; attempt++) {
        try {
          if (attempt > 0) bookingDoc.code = generateBookingCode6();
          result = await bookings.insertOne(bookingDoc);
          break;
        } catch (e) {
          if (
            e &&
            typeof e === "object" &&
            "code" in e &&
            (e as { code?: number }).code === 11000
          ) {
            const msg = (e as { message?: string }).message ?? "";
            if (msg.includes("uniq_code")) continue;
            throw e;
          }
          throw e;
        }
      }
    } catch (insertErr) {
      await rollbackSlotLocks();
      throw insertErr;
    }
    if (!result) {
      await rollbackSlotLocks();
      throw new Error("Failed to allocate booking code");
    }

    if (linkedClientId) {
      try {
        await insertBookingConsume({
          creditLedger,
          clientId: linkedClientId,
          bookingId: result.insertedId,
          now,
        });
      } catch (ledgerErr) {
        await bookings.deleteOne({ _id: result.insertedId });
        await rollbackSlotLocks();
        throw ledgerErr;
      }
    }

    try {
      await sendBookingCreatedEmail({
        to: emailTrim,
        name: nameTrim,
        classTypeName: itemRef.name,
        whatsapp,
        bookingCode: bookingDoc.code,
        dateKey: slotRef.dateKey,
        startMin: slotRef.startMin,
        endMin: slotRef.endMin,
        businessTimeZone: BUSINESS_TIME_ZONE,
      });
    } catch {
      // ignore
    }

    try {
      await Promise.all([
        sendBookingConfirmedWhatsApp({
          to: whatsapp,
          name: nameTrim,
          classTypeName: itemRef.name,
          bookingCode: bookingDoc.code,
          dateKey: slotRef.dateKey,
          startMin: slotRef.startMin,
          endMin: slotRef.endMin,
          businessTimeZone: BUSINESS_TIME_ZONE,
        }).catch(() => {}),
        sendAdminWhatsAppNotification({
          kind: "booking_confirmed",
          name: nameTrim,
          email: emailTrim,
          whatsapp,
          bookingCode: bookingDoc.code,
          classTypeName: itemRef.name,
          dateKey: slotRef.dateKey,
          startMin: slotRef.startMin,
          endMin: slotRef.endMin,
          businessTimeZone: BUSINESS_TIME_ZONE,
        }).catch(() => {}),
      ]);
    } catch {
      // ignore
    }

    const payload = jsonOk({
      bookingId: result.insertedId.toHexString(),
      bookingCode: bookingDoc.code,
      slotId: slotRef._id.toHexString(),
      signedUp: Boolean(signupClientId),
    });
    if (signupClientId) {
      return setClientSessionCookie(payload, signupClientId, req);
    }
    return payload;
  } catch (e) {
    if (e instanceof HttpError) return jsonError(e.message, e.status, e.details);
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
