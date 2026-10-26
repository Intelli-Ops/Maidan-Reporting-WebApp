import { apiRequest } from '@/api/client';
import { buildQuery } from '@/lib/queryString';
import type { BookingsDashboardData, BookingsDashboardFilters } from '@/lib/types/bookingsDashboard';

export function getBookingsDashboard(filters: BookingsDashboardFilters) {
  const qs = buildQuery({
    startDate: filters.startDate,
    endDate: filters.endDate,
    facilityId: filters.facilityId,
    sportTypeId: filters.sportTypeId,
    paymentMethodId: filters.paymentMethodId,
    granularity: filters.granularity,
    binLimit: filters.binLimit,
  });
  return apiRequest<{ success: true; data: BookingsDashboardData }>(`/dashboard/bookings${qs}`);
}
