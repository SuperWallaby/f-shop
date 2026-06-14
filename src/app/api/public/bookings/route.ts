import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getCollections } from "@/lib/db";
import { jsonError, jsonOk } from "../../_utils/http";
import { publicMemberBookingSchema } from "@/lib/schemas";
import { sendBookingCreatedEmail } from "@/lib/email";
import type { BookingDb } from "@/lib/db";
import { BUSINESS_TIME_ZONE } from "@/lib/constants";
import { getBookingRulesFromSettings, isSlotBookableByRules } from "@/lib/bookingRules";
import { usesExclusiveTimeBlocking } from "@/lib/exclusiveBooking";
import { generateBookingCode6 } from "@/lib/bookingCode";
import { acquireExclusiveLocks } from "@/lib/exclusiveLocks";
import { sendAdminWhatsAppNotification, sendBookingConfirmedWhatsApp } from "@/lib/twilioWhatsApp";
import { getClientIdFromRequest } from "@/app/api/_utils/clientAuth";
import { getCreditBalance } from "@/lib/credits";
import { normalizeWhatsapp } from "@/lib/whatsapp";

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
    const clientId = getClientIdFromRequest(req);
    if (!clientId) return jsonError("Sign in required to book.", 401);

    const body = await req.json().catch(() => null);
    const parsed = publicMemberBookingSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid body", 400, parsed.error.flatten());
    }

    const { slotId, consentWhatsapp, marketingOptIn, whatsapp: bodyWa } =
      parsed.data;
    if (consentWhatsapp !== true) {
      return jsonError("Consent required", 400, {
        field: "consentWhatsapp",
        message:
          "Please agree to receive booking-related updates via WhatsApp.",
      });
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
    } = await getCollections();
    const now = new Date();

    const client = await clients.findOne({ _id: clientId });
    if (!client) return jsonError("Client account not found", 404);

    const nameTrim = (client.name ?? "").trim();
    if (!nameTrim) {
      return jsonError("Please set your display name before booking.", 400);
    }

    const emailTrim = (client.email ?? "").trim().toLowerCase();
    if (!emailTrim || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      return jsonError("Your profile needs a valid email address.", 400);
    }

    const whatsappNorm = normalizeWhatsapp(
      typeof bodyWa === "string" && bodyWa.trim() ? bodyWa : client.whatsapp ?? "",
    );
    if (!whatsappNorm) {
      return jsonError(
        "Please add your WhatsApp number (profile or booking form).",
        400,
        { field: "whatsapp" },
      );
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

    const credits = await getCreditBalance({
      creditLedger,
      clientId,
      now,
    });
    if (credits.balance < 1) {
      await rollbackSlotLocks();
      return jsonError(
        "You need credits to complete a booking. Purchase a package first.",
        409,
      );
    }

    const bookingDoc: BookingDb = {
        code: generateBookingCode6(),
        slotId: slotRef._id,
        detached: false,
        itemId: itemRef._id,
        clientId,
        exclusiveKey: exclusiveKey || undefined,
        name: nameTrim,
        email: emailTrim,
        whatsapp: whatsappNorm,
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

      try {
        await creditLedger.insertOne({
          clientId,
          type: "booking_consume",
          amount: -1,
          bookingId: result.insertedId,
          note: "Class booking",
          createdAt: now,
        });
      } catch (ledgerErr) {
        await bookings.deleteOne({ _id: result.insertedId });
        await rollbackSlotLocks();
        throw ledgerErr;
      }

      try {
        await sendBookingCreatedEmail({
          to: emailTrim,
          name: nameTrim,
          classTypeName: itemRef.name,
          whatsapp: whatsappNorm,
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
            to: whatsappNorm,
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
            whatsapp: whatsappNorm,
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

      if (
        typeof bodyWa === "string" &&
        bodyWa.trim() &&
        whatsappNorm !== normalizeWhatsapp(client.whatsapp ?? "")
      ) {
        await clients.updateOne(
          { _id: clientId },
          { $set: { whatsapp: whatsappNorm, updatedAt: new Date() } },
        );
      }

      return jsonOk({
        bookingId: result.insertedId.toHexString(),
        bookingCode: bookingDoc.code,
        slotId: slotRef._id.toHexString(),
      });
  } catch (e) {
    if (e instanceof HttpError) return jsonError(e.message, e.status, e.details);
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
