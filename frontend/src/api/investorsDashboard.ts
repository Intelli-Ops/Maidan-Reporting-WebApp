import { apiRequest } from '@/api/client';
import { buildQuery } from '@/lib/queryString';
import type { InvestorsDashboardData, InvestorsDashboardFilters } from '@/lib/types/investorsDashboard';

export function getInvestorsDashboard(filters: InvestorsDashboardFilters) {
  const qs = buildQuery({
    startDate: filters.startDate,
    endDate: filters.endDate,
    facilityId: filters.facilityId,
    investorId: filters.investorId,
    status: filters.status,
    targetMonths: filters.targetMonths,
    trailingMonths: filters.trailingMonths,
  });
  return apiRequest<{ success: true; data: InvestorsDashboardData }>(`/dashboard/investors${qs}`);
}
