import { useQuery } from '@tanstack/react-query';
import * as lookupsApi from '@/api/lookups';

// Facilities/sports/payment-methods change rarely — a long staleTime avoids
// refetching them every time a filter bar mounts.
const LOOKUP_STALE_TIME = 10 * 60_000;

export function useFacilities() {
  return useQuery({
    queryKey: ['lookups', 'facilities'],
    queryFn: async () => (await lookupsApi.getFacilities()).data,
    staleTime: LOOKUP_STALE_TIME,
  });
}

export function useSportTypes() {
  return useQuery({
    queryKey: ['lookups', 'sportTypes'],
    queryFn: async () => (await lookupsApi.getSportTypes()).data,
    staleTime: LOOKUP_STALE_TIME,
  });
}

export function usePaymentMethods() {
  return useQuery({
    queryKey: ['lookups', 'paymentMethods'],
    queryFn: async () => (await lookupsApi.getPaymentMethods()).data,
    staleTime: LOOKUP_STALE_TIME,
  });
}

export function useInvestors() {
  return useQuery({
    queryKey: ['lookups', 'investors'],
    queryFn: async () => (await lookupsApi.getInvestors()).data,
    staleTime: LOOKUP_STALE_TIME,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['lookups', 'categories'],
    queryFn: async () => (await lookupsApi.getCategories()).data,
    staleTime: LOOKUP_STALE_TIME,
  });
}

export function useAccountReferences() {
  return useQuery({
    queryKey: ['lookups', 'accountReferences'],
    queryFn: async () => (await lookupsApi.getAccountReferences()).data,
    staleTime: LOOKUP_STALE_TIME,
  });
}
