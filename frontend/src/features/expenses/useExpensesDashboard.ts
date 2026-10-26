import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getExpensesDashboard } from '@/api/expensesDashboard';
import type { ExpensesDashboardFilters } from '@/lib/types/expensesDashboard';

export function useExpensesDashboard(filters: ExpensesDashboardFilters) {
  return useQuery({
    queryKey: ['dashboard', 'expenses', filters],
    queryFn: async () => (await getExpensesDashboard(filters)).data,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}
