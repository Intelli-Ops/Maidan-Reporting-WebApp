import { apiRequest } from '@/api/client';
import type {
  AccountReferenceData,
  ExpenseCategory,
  Facility,
  Investor,
  PaymentMethod,
  SportType,
} from '@/lib/types/lookups';

export function getFacilities() {
  return apiRequest<{ success: true; data: Facility[] }>('/facilities');
}

export function getSportTypes() {
  return apiRequest<{ success: true; data: SportType[] }>('/sport-types');
}

export function getPaymentMethods() {
  return apiRequest<{ success: true; data: PaymentMethod[] }>('/payment-methods');
}

export function getInvestors() {
  return apiRequest<{ success: true; data: Investor[] }>('/investors');
}

export function getCategories() {
  return apiRequest<{ success: true; data: ExpenseCategory[] }>('/categories');
}

export function getAccountReferences() {
  return apiRequest<{ success: true; data: AccountReferenceData }>('/dashboard/expenses/account-references');
}
