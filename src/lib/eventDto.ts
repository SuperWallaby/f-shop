import type { ObjectId } from "mongodb";
import type { EventDb } from "@/lib/db";

export type PublicEventDto = {
  id: string;
  title: string;
  summary: string;
  description: string | null;
  imageUrl: string | null;
  startsAt: string | null;
  endsAt: string | null;
  location: string | null;
  priceLabel: string | null;
  capacityLabel: string | null;
  whatsappText: string | null;
  active?: boolean;
  sortOrder?: number;
};

export function eventDocToPublicDto(event: EventDb & { _id: ObjectId }): PublicEventDto {
  return {
    id: event._id.toHexString(),
    title: event.title,
    summary: event.summary,
    description: event.description ?? null,
    imageUrl: event.imageUrl ?? null,
    startsAt: event.startsAt?.toISOString() ?? null,
    endsAt: event.endsAt?.toISOString() ?? null,
    location: event.location ?? null,
    priceLabel: event.priceLabel ?? null,
    capacityLabel: event.capacityLabel ?? null,
    whatsappText: event.whatsappText ?? null,
  };
}

export function eventDocToAdminDto(event: EventDb & { _id: ObjectId }) {
  return {
    ...eventDocToPublicDto(event),
    active: event.active,
    sortOrder: event.sortOrder,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}
