/**
 * One-shot: merge WhatsApp-equivalent duplicate clients (+60… vs 60…).
 * Usage: node --env-file=.env.local scripts/dedupe-whatsapp-clients.mjs
 */
import { MongoClient } from "mongodb";

function whatsappDigitsCanonical(input) {
  let digits = String(input ?? "").replace(/[^0-9]/g, "");
  if (!digits) return "";
  if (digits.startsWith("0") && !digits.startsWith("00")) {
    digits = `60${digits.slice(1)}`;
  }
  return digits;
}

function normalizeWhatsapp(input) {
  const digits = whatsappDigitsCanonical(input);
  if (!digits) return "";
  return `+${digits}`;
}

function scoreClient(c) {
  let score = 0;
  if (c.passwordHash) score += 40;
  if (c.googleSub) score += 30;
  if (c.appleSub) score += 30;
  if ((c.email ?? "").trim()) score += 20;
  if ((c.name ?? "").trim()) score += 5;
  if ((c.whatsapp ?? "").trim()) score += 5;
  return score;
}

async function mergeClientInto(cols, primaryId, secondaryId, whatsapp) {
  const [primary, secondary] = await Promise.all([
    cols.clients.findOne({ _id: primaryId }),
    cols.clients.findOne({ _id: secondaryId }),
  ]);
  if (!primary || !secondary) return false;

  const now = new Date();
  const wa =
    normalizeWhatsapp(whatsapp || primary.whatsapp || secondary.whatsapp || "") ||
    primary.whatsapp ||
    secondary.whatsapp ||
    "";

  const patch = { updatedAt: now };
  if (wa) patch.whatsapp = wa;
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

  const secEmail = (secondary.email ?? "").trim().toLowerCase();
  if (secEmail) {
    await cols.bookings.updateMany(
      {
        email: {
          $regex: `^${secEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
          $options: "i",
        },
        $or: [{ clientId: { $exists: false } }, { clientId: null }],
      },
      { $set: { clientId: primaryId } },
    );
  }

  await cols.clients.updateOne({ _id: primaryId }, { $set: patch });
  await cols.clients.deleteOne({ _id: secondaryId });
  return true;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI missing");
    process.exit(1);
  }
  const dbName = process.env.MONGODB_DB || undefined;
  const client = new MongoClient(uri);
  await client.connect();
  const db = dbName ? client.db(dbName) : client.db();
  const cols = {
    clients: db.collection("clients"),
    creditLedger: db.collection("creditLedger"),
    orders: db.collection("orders"),
    bookings: db.collection("bookings"),
  };

  const withWa = await cols.clients
    .find({ whatsapp: { $exists: true, $type: "string", $ne: "" } })
    .project({ _id: 1, whatsapp: 1, name: 1, email: 1 })
    .toArray();

  const byDigits = new Map();
  for (const row of withWa) {
    const canon = whatsappDigitsCanonical(row.whatsapp ?? "");
    if (!canon) continue;
    const list = byDigits.get(canon) ?? [];
    if (!list.some((id) => id.equals(row._id))) list.push(row._id);
    byDigits.set(canon, list);
  }

  let merges = 0;
  let groups = 0;
  for (const [digits, ids] of byDigits) {
    if (ids.length < 2) continue;
    groups += 1;
    const docs = await cols.clients.find({ _id: { $in: ids } }).toArray();
    if (docs.length < 2) continue;
    docs.sort((a, b) => {
      const ds = scoreClient(b) - scoreClient(a);
      if (ds !== 0) return ds;
      return (a.createdAt?.getTime?.() ?? 0) - (b.createdAt?.getTime?.() ?? 0);
    });
    const primary = docs[0];
    console.log(
      `Merging ${docs.length} → ${normalizeWhatsapp(digits)} primary=${primary.email || primary.name} (${primary._id})`,
    );
    for (const doc of docs.slice(1)) {
      const ok = await mergeClientInto(
        cols,
        primary._id,
        doc._id,
        primary.whatsapp || doc.whatsapp,
      );
      if (ok) {
        merges += 1;
        console.log(`  merged secondary ${doc.email || doc.name} (${doc._id})`);
      }
    }
  }

  let normalized = 0;
  const remaining = await cols.clients
    .find({ whatsapp: { $exists: true, $type: "string", $ne: "" } })
    .project({ _id: 1, whatsapp: 1 })
    .toArray();
  for (const row of remaining) {
    const wa = normalizeWhatsapp(row.whatsapp ?? "");
    if (wa && wa !== row.whatsapp) {
      await cols.clients.updateOne(
        { _id: row._id },
        { $set: { whatsapp: wa, updatedAt: new Date() } },
      );
      normalized += 1;
    }
  }

  await db.collection("settings").updateOne(
    { _id: "singleton" },
    {
      $set: {
        whatsappDedupeV1Done: true,
        updatedAt: new Date(),
      },
    },
    { upsert: true },
  );

  console.log(
    JSON.stringify({ groupsChecked: groups, merges, normalized }, null, 2),
  );
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
