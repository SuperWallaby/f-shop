export type AdminDaySlot = {
  id: string;
  itemId: string;
  itemName: string;
  itemColor: string;
  dateKey: string;
  startMin: number;
  endMin: number;
  capacity: number;
  bookedCount: number;
  available: number;
  cancelled: boolean;
  notes: string;
  startUtc: string;
  endUtc: string;
  bookings: Array<{
    id: string;
    code: string;
    name: string;
    email: string;
    whatsapp?: string;
    status: "confirmed" | "cancelled" | "no_show";
    starred?: boolean;
    createdAt: string;
    cancelledAt: string | null;
  }>;
};

export type CalendarDayDto = {
  dateKey: string;
  slots: Array<{
    id: string;
    itemId: string;
    itemName: string;
    itemColor: string;
    startMin: number;
    endMin: number;
    capacity: number;
    bookedCount: number;
    cancelled: boolean;
    notes: string;
    bookings: Array<{
      id: string;
      code: string;
      name: string;
      email?: string;
      whatsapp?: string;
      status: "confirmed" | "cancelled" | "no_show";
      starred?: boolean;
      createdAt?: string;
      cancelledAt?: string | null;
      noShowAt?: string | null;
      adminNote?: string;
    }>;
  }>;
};

export type BookingListItem = {
  id: string;
  code: string;
  name: string;
  email: string;
  whatsapp: string;
  itemName: string;
  itemColor: string;
  adminNote: string;
  starred: boolean;
  status: "confirmed" | "cancelled" | "no_show";
  createdAt: string;
  dateKey: string;
  startMin: number;
  endMin: number;
  detached: boolean;
  slotId: string | null;
};

