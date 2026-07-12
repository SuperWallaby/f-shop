export type AdminStatsRange = {
  from: string;
  to: string;
};

export type AdminStatsKpis = {
  totalBookings: number;
  confirmedBookings: number;
  cancelledBookings: number;
  noShowBookings: number;
  distinctCustomers: number;
  cancellationRate: number;
  noShowRate: number;
  returningCustomerRate: number;
  estimatedRevenue: number;
  estimatedRevenueMatchedBookings: number;
};

export type AdminStatsTrendPoint = {
  dateKey: string;
  totalBookings: number;
  confirmedBookings: number;
  cancelledBookings: number;
  noShowBookings: number;
};

export type AdminStatsItemPoint = {
  itemId: string;
  itemName: string;
  itemColor: string;
  totalBookings: number;
  confirmedBookings: number;
  cancelledBookings: number;
  noShowBookings: number;
  estimatedRevenue: number;
};

export type AdminStatsWeekdayPoint = {
  weekdayIndex: number;
  weekdayLabel: string;
  totalBookings: number;
  confirmedBookings: number;
  cancelledBookings: number;
  noShowBookings: number;
};

export type AdminStatsCustomerMix = {
  newCustomers: number;
  returningCustomers: number;
};

export type AdminStatsTopCustomer = {
  customerKey: string;
  name: string;
  email: string;
  whatsapp: string;
  totalBookings: number;
  confirmedBookings: number;
  cancelledBookings: number;
  noShowBookings: number;
  latestBookingDateKey: string;
};

export type AdminStatsResponse = {
  range: AdminStatsRange;
  kpis: AdminStatsKpis;
  trend: AdminStatsTrendPoint[];
  items: AdminStatsItemPoint[];
  weekdays: AdminStatsWeekdayPoint[];
  customerMix: AdminStatsCustomerMix;
  topCustomers: AdminStatsTopCustomer[];
};
