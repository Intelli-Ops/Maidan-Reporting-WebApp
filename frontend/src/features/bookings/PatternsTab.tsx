import { BookingsCalendar } from '@/components/reporting/BookingsCalendar';
import { ChartCard } from '@/components/reporting/ChartCard';
import { WeekdaySlopeChart } from '@/components/reporting/WeekdaySlopeChart';
import { UnderusedBinsTable } from '@/features/bookings/UnderusedBinsTable';
import type { BookingsDashboardData } from '@/lib/types/bookingsDashboard';

export function PatternsTab({ data }: { data: BookingsDashboardData }) {
  const { revenueHeatmap, likeForLikeDay, underusedHighValueBins, meta } = data;

  return (
    <div className="flex flex-col gap-6">
      <ChartCard
        title="Booking Calendar"
        description="Every date in the selected period. Darker means busier."
      >
        <BookingsCalendar
          cells={revenueHeatmap}
          startDate={meta.filters.startDate}
          endDate={meta.filters.endDate}
        />
      </ChartCard>

      <ChartCard
        title="Which Weekdays Are Gaining or Fading"
        description="Each weekday's average revenue this period vs the period before it."
      >
        <WeekdaySlopeChart data={likeForLikeDay} />
      </ChartCard>

      <ChartCard
        title="Underused High-Value Card BINs"
        description="Bank cards with strong discounts that customers rarely use."
      >
        <UnderusedBinsTable data={underusedHighValueBins} />
      </ChartCard>
    </div>
  );
}
