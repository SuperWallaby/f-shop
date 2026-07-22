import type { Collection, Filter, ObjectId } from "mongodb";
import type {
  BookingDb,
  ClientDb,
  CreditLedgerDb,
  OrderDb,
} from "@/lib/db";
import {
  clientWhatsappFields,
  normalizeWhatsapp,
  whatsappDigitsCanonical,
  whatsappStorageVariants,
} from "@/lib/whatsapp";

type ClientCols = {
  clients: Collection<ClientDb>;
  creditLedger: Collection<CreditLedgerDb>;
  orders: Collection<OrderDb>;
  bookings: Collection<BookingDb>;
};

export async function findClientsByWhatsapp(
  clients: Collection<ClientDb>,
  rawWhatsapp: string,
): Promise<Array<ClientDb & { _id: ObjectId }>> {
  const digits = whatsappDigitsCanonical(rawWhatsapp);
  const variants = whatsappStorageVariants(rawWhatsapp);
  if (!digits && !variants.length) return [];
  const rows = await clients
    .find({
      $or: [
        ...(digits ? [{ whatsappDigits: digits }] : []),
        ...(variants.length ? [{ whatsapp: { $in: variants } }] : []),
      ],
    } as Filter<ClientDb>)
    .limit(20)
    .toArray();
  // Dedupe by id
  const seen = new Set<string>();
  const out: Array<ClientDb & { _id: ObjectId }> = [];
  for (const c of rows) {
    if (!c._id) continue;
    const id = c._id.toHexString();
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(c as ClientDb & { _id: ObjectId });
  }
  return out;
}

function scoreClient(c: ClientDb): number {
  let score = 0;
  if (c.passwordHash) score += 40;
  if (c.googleSub) score += 30;
  if (c.appleSub) score += 30;
  if ((c.email ?? "").trim()) score += 20;
  if ((c.name ?? "").trim()) score += 5;
  if ((c.whatsapp ?? "").trim()) score += 5;
  // Prefer older accounts as merge target (stable id)
  score += Math.max(
    0,
    10 - Math.floor((Date.now() - (c.createdAt?.getTime?.() ?? Date.now())) / (864e5 * 30)),
  );
  return score;
}

export function pickPrimaryClient(
  clients: Array<ClientDb & { _id: ObjectId }>,
): ClientDb & { _id: ObjectId } {
  const sorted = [...clients].sort((a, b) => {
    const ds = scoreClient(b) - scoreClient(a);
    if (ds !== 0) return ds;
    return (a.createdAt?.getTime?.() ?? 0) - (b.createdAt?.getTime?.() ?? 0);
  });
  return sorted[0]!;
}

/**
 * Move ledger / orders / bookings from secondary → primary, then delete secondary.
 * Canonicalizes primary.whatsapp.
 */
export async function mergeClientInto(
  cols: ClientCols,
  primaryId: ObjectId,
  secondaryId: ObjectId,
  opts?: { whatsapp?: string },
): Promise<{ merged: true } | { merged: false; reason: string }> {
  if (primaryId.equals(secondaryId)) {
    return { merged: false, reason: "same_id" };
  }

  const [primary, secondary] = await Promise.all([
    cols.clients.findOne({ _id: primaryId }),
    cols.clients.findOne({ _id: secondaryId }),
  ]);
  if (!primary || !secondary) {
    return { merged: false, reason: "not_found" };
  }

  const now = new Date();
  const wa =
    normalizeWhatsapp(opts?.whatsapp || primary.whatsapp || secondary.whatsapp || "") ||
    primary.whatsapp ||
    secondary.whatsapp ||
    "";
  const waFields = wa ? clientWhatsappFields(wa) : null;

  const patch: Partial<ClientDb> = {
    updatedAt: now,
    ...(waFields
      ? { whatsapp: waFields.whatsapp, whatsappDigits: waFields.whatsappDigits }
      : {}),
  };
  if (!(primary.name ?? "").trim() && (secondary.name ?? "").trim()) {
    patch.name = secondary.name;
  }
  if (!(primary.email ?? "").trim() && (secondary.email ?? "").trim()) {
    patch.email = secondary.email;
  }
  if (!primary.passwordHash && secondary.passwordHash) {
    patch.passwordHash = secondary.passwordHash;
  }
  if (!primary.googleSub && secondary.googleSub) {
    patch.googleSub = secondary.googleSub;
  }
  if (!primary.appleSub && secondary.appleSub) {
    patch.appleSub = secondary.appleSub;
  }
  if (primary.studentStatus === "none" && secondary.studentStatus !== "none") {
    patch.studentStatus = secondary.studentStatus;
  }

  await Promise.all([
    cols.creditLedger.updateMany(
      { clientId: secondaryId },
      { $set: { clientId: primaryId } },
    ),
    cols.orders.updateMany(
      { clientId: secondaryId },
      { $set: { clientId: primaryId } },
    ),
    cols.bookings.updateMany(
      { clientId: secondaryId },
      { $set: { clientId: primaryId } },
    ),
  ]);

  // Also attach bookings that used secondary email but never got clientId
  const secEmail = (secondary.email ?? "").trim().toLowerCase();
  if (secEmail) {
    await cols.bookings.updateMany(
      {
        email: {
          $regex: `^${secEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
          $options: "i",
        },
        $or: [
          { clientId: { $exists: false } },
          { clientId: { $eq: null } },
        ],
      } as Filter<BookingDb>,
      { $set: { clientId: primaryId } },
    );
  }

  await cols.clients.updateOne({ _id: primaryId }, { $set: patch });
  await cols.clients.deleteOne({ _id: secondaryId });

  return { merged: true };
}

/** Merge every WhatsApp-equivalent client group into one primary. */
export async function dedupeClientsByWhatsapp(cols: ClientCols): Promise<{
  groupsChecked: number;
  merges: number;
}> {
  const withWa = await cols.clients
    .find({
      whatsapp: { $exists: true, $type: "string", $ne: "" },
    })
    .project({ _id: 1, whatsapp: 1 })
    .toArray();

  const byDigits = new Map<string, ObjectId[]>();
  for (const row of withWa) {
    if (!row._id) continue;
    const canon = whatsappDigitsCanonical(row.whatsapp ?? "");
    if (!canon) continue;
    const list = byDigits.get(canon) ?? [];
    if (!list.some((id) => id.equals(row._id!))) list.push(row._id);
    byDigits.set(canon, list);
  }

  let merges = 0;
  let groupsChecked = 0;
  for (const [, ids] of byDigits) {
    if (ids.length < 2) continue;
    groupsChecked += 1;
    const docs = (
      await cols.clients.find({ _id: { $in: ids } }).toArray()
    ).filter((c): c is ClientDb & { _id: ObjectId } => Boolean(c._id));
    if (docs.length < 2) continue;
    const primary = pickPrimaryClient(docs);
    for (const doc of docs) {
      if (doc._id.equals(primary._id)) continue;
      const res = await mergeClientInto(cols, primary._id, doc._id, {
        whatsapp: primary.whatsapp || doc.whatsapp,
      });
      if (res.merged) merges += 1;
    }
    // Canonicalize survivor whatsapp even if no merge left
    const fields = clientWhatsappFields(primary.whatsapp ?? "");
    if (fields) {
      await cols.clients.updateOne(
        { _id: primary._id },
        {
          $set: {
            whatsapp: fields.whatsapp,
            whatsappDigits: fields.whatsappDigits,
            updatedAt: new Date(),
          },
        },
      );
    }
  }

  // Normalize remaining single-account whatsapps to canonical form
  for (const row of withWa) {
    if (!row._id) continue;
    const fields = clientWhatsappFields(row.whatsapp ?? "");
    if (
      fields &&
      (fields.whatsapp !== row.whatsapp ||
        (row as ClientDb).whatsappDigits !== fields.whatsappDigits)
    ) {
      await cols.clients.updateOne(
        { _id: row._id },
        {
          $set: {
            whatsapp: fields.whatsapp,
            whatsappDigits: fields.whatsappDigits,
            updatedAt: new Date(),
          },
        },
      );
    }
  }

  return { groupsChecked, merges };
}
