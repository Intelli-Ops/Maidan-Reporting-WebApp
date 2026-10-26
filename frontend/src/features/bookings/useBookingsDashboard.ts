import { keepPreviousData, useQuery } from '@tanstack/react-query';
import * as dashboardApi from '@/api/dashboard';
import { validateBookingsRange, type BookingsView } from '@/lib/datePresets';
import type { BookingsDashboardFilters } from '@/lib/types/bookingsDashboard';

// placeholderData: keepPreviousData means switching filters never flashes a
// blank loading state; staleTime keeps tab-switching within the dashboard
// (Revenue <-> Patterns) from ever re-fetching, since both tabs read this
// same query — the whole response is treated as one atomic object per the
// architecture plan, not decomposed into per-section queries.
export function useBookingsDashboard(filters: BookingsDashboardFilters, view: BookingsView) {
  // A half-typed custom range is not a query worth sending. Every keystroke in
  // the date inputs rewrites the URL, and an unbounded range fires a
  // full-table scan whose answer is thrown away as soon as the second date
  // lands — several such requests overlapping is what used to saturate the
  // database pool and 500 the dashboard. Wait until the range is complete and
  // valid for the tab being viewed.
  const enabled =
    Boolean(filters.startDate && filters.endDate) &&
    validateBookingsRange(filters.startDate ?? null, filters.endDate ?? null, view) === null;

  return useQuery({
    queryKey: ['dashboard', 'bookings', filters],
    queryFn: async () => (await dashboardApi.getBookingsDashboard(filters)).data,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    enabled,
  });
}
