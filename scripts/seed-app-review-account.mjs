/**
 * Creates or refreshes the App Store review test account in MongoDB.
 *
 * Usage: node scripts/seed-app-review-account.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");

const REVIEW_EMAIL = "appreview@fasea.studio";
const REVIEW_NAME = "App Review";
const REVIEW_WHATSAPP = "60145403560";
const REVIEW_CREDITS = 10;

function loadEnvLocal() {
  const file = path.join(repoRoot, ".env.local");
  if (!existsSync(file)) {
    throw new Error("Missing .env.local — set MONGODB_URI first.");
  }
  const text = readFileSync(file, "utf8");
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    const comment = value.indexOf(" #");
    if (comment >= 0) value = value.slice(0, comment).trim();
    value = value.replace(/^["']|["']$/g, "");
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function makeCustomerKey(email) {
  return `em:${email.trim().toLowerCase()}`;
}

async function main() {
  loadEnvLocal();
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set in .env.local");

  const email = REVIEW_EMAIL.trim().toLowerCase();
  const now = new Date();

  const client = new MongoClient(uri);
  await client.connect();
  try {
    const dbName =
      process.env.MONGODB_DB?.trim() ||
      new URL(uri.replace(/^mongodb(\+srv)?:\/\//, "http://")).pathname.replace(/^\//, "") ||
      undefined;
    const db = dbName ? client.db(dbName) : client.db();
    const clients = db.collection("clients");
    const creditLedger = db.collection("creditLedger");

    let row = await clients.findOne({ email });
    if (!row) {
      const ins = await clients.insertOne({
        customerKey: makeCustomerKey(email),
        name: REVIEW_NAME,
        email,
        whatsapp: REVIEW_WHATSAPP,
        studentStatus: "none",
        pushMarketingOptIn: true,
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now,
      });
      row = await clients.findOne({ _id: ins.insertedId });
    } else {
      await clients.updateOne(
        { _id: row._id },
        {
          $set: {
            name: REVIEW_NAME,
            whatsapp: REVIEW_WHATSAPP,
            updatedAt: now,
          },
        },
      );
      row = await clients.findOne({ _id: row._id });
    }

    if (!row?._id) throw new Error("Could not create review client");

    await creditLedger.deleteMany({
      clientId: row._id,
      type: "admin_adjust",
      note: "App Store review account seed",
    });

    await creditLedger.insertOne({
      clientId: row._id,
      type: "admin_adjust",
      amount: REVIEW_CREDITS,
      note: "App Store review account seed",
      createdAt: now,
    });

    const ledger = await creditLedger
      .find({ clientId: row._id })
      .sort({ createdAt: 1 })
      .toArray();
    const balance = ledger.reduce((sum, entry) => {
      if (entry.amount < 0) return sum + entry.amount;
      if (entry.amount <= 0) return sum;
      if (!entry.expiresAt || entry.expiresAt > now || entry.expiryApproved === false) {
        return sum + entry.amount;
      }
      return sum;
    }, 0);

    console.log("App Store review account ready:");
    console.log(`  Email:    ${email}`);
    console.log(`  Name:     ${REVIEW_NAME}`);
    console.log(`  Credits:  ${balance}`);
    console.log(`  ClientId: ${row._id.toHexString()}`);
    console.log("");
    console.log("Sign in: open the app → enter the email above (no password).");
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
