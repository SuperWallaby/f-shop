import { NextRequest } from "next/server";
import { getCollections } from "@/lib/db";
import { eventDocToAdminDto } from "@/lib/eventDto";
import { adminEventCreateSchema } from "@/lib/schemas";
import { requireAdmin } from "../../_utils/adminAuth";
import { jsonError, jsonOk } from "../../_utils/http";

function optionalDate(value: string | null | undefined) {
  return value ? new Date(value) : undefined;
}

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth) return auth;

  try {
    const { events } = await getCollections();
    const docs = await events.find({}).sort({ sortOrder: 1, startsAt: 1 }).toArray();
    return jsonOk({ events: docs.map((event) => eventDocToAdminDto(event)) });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}

export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth) return auth;

  try {
    const body = await req.json().catch(() => null);
    const parsed = adminEventCreateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid body", 400, parsed.error.flatten());
    }

    const { events } = await getCollections();
    const now = new Date();
    const d = parsed.data;
    const ins = await events.insertOne({
      title: d.title,
      summary: d.summary,
      description: d.description ?? undefined,
      imageUrl: d.imageUrl ?? undefined,
      startsAt: optionalDate(d.startsAt),
      endsAt: optionalDate(d.endsAt),
      location: d.location ?? undefined,
      priceLabel: d.priceLabel ?? undefined,
      capacityLabel: d.capacityLabel ?? undefined,
      whatsappText: d.whatsappText ?? undefined,
      active: d.active ?? true,
      sortOrder: d.sortOrder ?? 1000,
      createdAt: now,
      updatedAt: now,
    });

    const created = await events.findOne({ _id: ins.insertedId });
    if (!created) return jsonError("Insert failed", 500);
    return jsonOk({ event: eventDocToAdminDto(created) });
  } catch (e) {
    return jsonError("Server error", 500, e instanceof Error ? e.message : e);
  }
}
