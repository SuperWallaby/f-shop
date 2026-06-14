/**
 * Exclusive time blocking is for single-capacity classes (Private, Duet) that
 * share physical equipment. Multi-seat group classes use bookedCount vs capacity.
 */
export function usesExclusiveTimeBlocking(capacity: number): boolean {
  return capacity <= 1;
}

export type ExclusiveOverlapBooking = {
  itemId: string;
  startMin: number;
  endMin: number;
};

export function isSlotBlockedByExclusiveOverlap(args: {
  itemCapacity: number;
  itemId: string;
  exclusiveKey: string;
  slotStartMin: number;
  slotEndMin: number;
  otherBookings: ExclusiveOverlapBooking[];
}): boolean {
  const exKey = (args.exclusiveKey ?? "").trim();
  if (!exKey || !usesExclusiveTimeBlocking(args.itemCapacity)) return false;
  return args.otherBookings.some(
    (b) =>
      b.itemId !== args.itemId &&
      b.startMin < args.slotEndMin &&
      b.endMin > args.slotStartMin,
  );
}
