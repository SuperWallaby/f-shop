import { MongoServerError, ObjectId, type Collection, type Filter } from "mongodb";
import type { BookingDb, ClientDb, CreditLedgerDb, OrderDb } from "@/lib/db";
import {
  findClientsByWhatsapp,
  mergeClientInto,
  pickPrimaryClient,
} from "@/lib/clientMerge";
import {
  backfillBookingConsumesForClient,
  makeCustomerKey,
} from "@/lib/credits";
import {
  clientWhatsappFields,
  whatsappDigitsCanonical,
  whatsappStorageVariants,
} from "@/lib/whatsapp";

function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Unlinked bookings that match this email and/or WhatsApp. */
export function unlinkedBookingsMatchFilter(args: {
  email?: string;
  whatsapp?: string;
}): Filter<BookingDb> | null {
  const email = (args.email ?? "").trim().toLowerCase();
  const variants = args.whatsapp ? whatsappStorageVariants(args.whatsapp) : [];
  const identity: Filter<BookingDb>[] = [];
  if (email) {
    identity.push({
      email: { $regex: `^${escapeRegex(email)}$`, $options: "i" },
    });
  }
  if (variants.length) {
    identity.push({ whatsapp: { $in: variants } });
  }
  if (!identity.length) return null;
  return {
    $and: [
      identity.length === 1 ? identity[0]! : { $or: identity },
      { $or: [{ clientId: { $exists: false } }, { clientId: null }] },
    ],
  } as Filter<BookingDb>;
}

/** Bookings belonging to a client by id, email, or WhatsApp. */
export function clientBookingHistoryFilter(args: {
  clientId: ObjectId;
  email?: string;
  whatsapp?: string;
}): Filter<BookingDb> {
  const email = (args.email ?? "").trim();
  const variants = args.whatsapp ? whatsappStorageVariants(args.whatsapp) : [];
  const or: Filter<BookingDb>[] = [{ clientId: args.clientId }];
  if (email) {
    or.push({
      email: { $regex: `^${escapeRegex(email)}$`, $options: "i" },
    });
  }
  if (variants.length) {
    or.push({ whatsapp: { $in: variants } });
  }
  return (or.length === 1 ? or[0]! : { $or: or }) as Filter<BookingDb>;
}

async function mergeWhatsappDuplicates(args: {
  clients: Collection<ClientDb>;
  bookings: Collection<BookingDb>;
  creditLedger: Collection<CreditLedgerDb>;
  orders: Collection<OrderDb>;
  matches: Array<ClientDb & { _id: ObjectId }>;
  whatsapp: string;
}): Promise<ClientDb & { _id: ObjectId }> {
  const primary = pickPrimaryClient(args.matches);
  if (args.matches.length < 2) return primary;

  const cols = {
    clients: args.clients,
    bookings: args.bookings,
    creditLedger: args.creditLedger,
    orders: args.orders,
  };
  for (const other of args.matches) {
    if (other._id.equals(primary._id)) continue;
    await mergeClientInto(cols, primary._id, other._id, {
      whatsapp: args.whatsapp || primary.whatsapp || other.whatsapp,
    });
  }
  const fresh = await args.clients.findOne({ _id: primary._id });
  return (fresh as ClientDb & { _id: ObjectId }) ?? primary;
}

/**
 * Resolve client for a booking: WhatsApp first (same phone = same account),
 * then email. Optionally create a client and link past bookings + backfill credits.
 * Phone variants (+60 / 60 / 0…) are treated as one account and merged.
 */
export async function resolveOrCreateBookingClient(args: {
  clients: Collection<ClientDb>;
  bookings: Collection<BookingDb>;
  creditLedger: Collection<CreditLedgerDb>;
  orders: Collection<OrderDb>;
  name: string;
  email: string;
  whatsapp: string;
  now?: Date;
  createIfMissing?: boolean;
}): Promise<{
  clientId: ObjectId | undefined;
  created: boolean;
  whatsappNormalized: string;
}> {
  const now = args.now ?? new Date();
  const emailTrim = args.email.trim().toLowerCase();
  const nameTrim = args.name.trim();
  const waFields = args.whatsapp.trim()
    ? clientWhatsappFields(args.whatsapp.trim())
    : null;
  const whatsappNormalized = waFields?.whatsapp ?? "";
  const createIfMissing = args.createIfMissing !== false;
  const cols = {
    clients: args.clients,
    bookings: args.bookings,
    creditLedger: args.creditLedger,
    orders: args.orders,
  };

  let client: (ClientDb & { _id: ObjectId }) | null = null;
  let created = false;

  if (whatsappNormalized) {
    const waMatches = await findClientsByWhatsapp(
      args.clients,
      whatsappNormalized,
    );
    if (waMatches.length) {
      client = await mergeWhatsappDuplicates({
        ...cols,
        matches: waMatches,
        whatsapp: whatsappNormalized,
      });
    }
  }

  if (!client && emailTrim) {
    const byEmail = await args.clients.findOne({ email: emailTrim });
    if (byEmail?._id) {
      client = byEmail as ClientDb & { _id: ObjectId };
    }
  }

  // Same phone wins: if email points at another row with empty/same WA, fold it in.
  if (client && emailTrim && whatsappNormalized) {
    const byEmail = await args.clients.findOne({ email: emailTrim });
    if (byEmail?._id && !byEmail._id.equals(client._id)) {
      const emailWa = whatsappDigitsCanonical(byEmail.whatsapp ?? "");
      const primaryWa = whatsappDigitsCanonical(
        client.whatsapp || whatsappNormalized,
      );
      if (!emailWa || emailWa === primaryWa) {
        await mergeClientInto(cols, client._id, byEmail._id, {
          whatsapp: whatsappNormalized,
        });
        const fresh = await args.clients.findOne({ _id: client._id });
        if (fresh?._id) client = fresh as ClientDb & { _id: ObjectId };
      }
    }
  }

  if (!client && createIfMissing && emailTrim) {
    const customerKey = makeCustomerKey({
      email: emailTrim,
      whatsapp: whatsappNormalized,
    });
    try {
      const ins = await args.clients.insertOne({
        customerKey,
        name: nameTrim || emailTrim,
        email: emailTrim,
        whatsapp: whatsappNormalized,
        ...(waFields ? { whatsappDigits: waFields.whatsappDigits } : {}),
        studentStatus: "none",
        createdAt: now,
        updatedAt: now,
      });
      const createdDoc = await args.clients.findOne({ _id: ins.insertedId });
      if (createdDoc?._id) {
        client = createdDoc as ClientDb & { _id: ObjectId };
        created = true;
      }
    } catch (e) {
      if (e instanceof MongoServerError && e.code === 11000) {
        if (whatsappNormalized) {
          const waMatches = await findClientsByWhatsapp(
            args.clients,
            whatsappNormalized,
          );
          if (waMatches.length) {
            client = await mergeWhatsappDuplicates({
              ...cols,
              matches: waMatches,
              whatsapp: whatsappNormalized,
            });
          }
        }
        if (!client) {
          const byEmail = await args.clients.findOne({ email: emailTrim });
          if (byEmail?._id) {
            client = byEmail as ClientDb & { _id: ObjectId };
          }
        }
        if (!client) {
          try {
            const ins = await args.clients.insertOne({
              customerKey: makeCustomerKey({ email: emailTrim }),
              name: nameTrim || emailTrim,
              email: emailTrim,
              whatsapp: "",
              studentStatus: "none",
              createdAt: now,
              updatedAt: now,
            });
            const createdDoc = await args.clients.findOne({
              _id: ins.insertedId,
            });
            if (createdDoc?._id) {
              client = createdDoc as ClientDb & { _id: ObjectId };
              created = true;
            }
          } catch (e2) {
            if (e2 instanceof MongoServerError && e2.code === 11000) {
              const byEmail = await args.clients.findOne({ email: emailTrim });
              if (byEmail?._id) {
                client = byEmail as ClientDb & { _id: ObjectId };
              }
            } else {
              throw e2;
            }
          }
        }
      } else {
        throw e;
      }
    }
  }

  if (!client?._id) {
    return { clientId: undefined, created: false, whatsappNormalized };
  }

  const clientId = client._id;
  const patch: Partial<ClientDb> = { updatedAt: now };
  if (waFields) {
    // Always canonicalize stored phone to +60… form
    if (
      client.whatsapp !== waFields.whatsapp ||
      client.whatsappDigits !== waFields.whatsappDigits
    ) {
      patch.whatsapp = waFields.whatsapp;
      patch.whatsappDigits = waFields.whatsappDigits;
    }
  }
  if (nameTrim && !(client.name ?? "").trim()) {
    patch.name = nameTrim;
  }
  if (emailTrim && !(client.email ?? "").trim()) {
    patch.email = emailTrim;
  }
  if (Object.keys(patch).length > 1) {
    await args.clients.updateOne({ _id: clientId }, { $set: patch });
  }

  const linkFilter = unlinkedBookingsMatchFilter({
    email: emailTrim || client.email,
    whatsapp: whatsappNormalized || client.whatsapp,
  });
  if (linkFilter) {
    await args.bookings.updateMany(linkFilter, { $set: { clientId } });
  }

  await backfillBookingConsumesForClient({
    bookings: args.bookings,
    creditLedger: args.creditLedger,
    clientId,
    now,
    note: "Linked past booking",
  });

  return { clientId, created, whatsappNormalized };
}

/** Digits helper exported for callers that need to store canonical WA. */
export function bookingWhatsappDigits(whatsapp: string): string {
  return whatsappDigitsCanonical(whatsapp);
}
