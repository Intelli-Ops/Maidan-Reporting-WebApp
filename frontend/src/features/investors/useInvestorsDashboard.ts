import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getInvestorsDashboard } from '@/api/investorsDashboard';
import type { InvestorsDashboardFilters } from '@/lib/types/investorsDashboard';

export function useInvestorsDashboard(filters: InvestorsDashboardFilters) {
  return useQuery({
    queryKey: ['dashboard', 'investors', filters],
    queryFn: async () => (await getInvestorsDashboard(filters)).data,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}
