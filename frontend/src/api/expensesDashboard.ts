import { apiRequest } from '@/api/client';
import { buildQuery } from '@/lib/queryString';
import type { ExpensesDashboardData, ExpensesDashboardFilters } from '@/lib/types/expensesDashboard';

export function getExpensesDashboard(filters: ExpensesDashboardFilters) {
  const qs = buildQuery({
    startDate: filters.startDate,
    endDate: filters.endDate,
    facilityId: filters.facilityId,
    categoryId: filters.categoryId,
    subcategoryId: filters.subcategoryId,
    paymentMethodId: filters.paymentMethodId,
    accountType: filters.accountType,
    sourceBank: filters.sourceBank,
    granularity: filters.granularity,
  });
  return apiRequest<{ success: true; data: ExpensesDashboardData }>(`/dashboard/expenses${qs}`);
}
