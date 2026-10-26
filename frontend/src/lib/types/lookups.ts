export interface Facility {
  id: number;
  code: string;
  name: string;
  location: string | null;
}

export interface SportType {
  id: number;
  name: string;
}

export interface PaymentMethod {
  id: number;
  name: string;
}

export interface Investor {
  id: number;
  name: string;
  contact_info: string | null;
}

export interface ExpenseCategory {
  id: number;
  name: string;
  parent_category_id: number | null;
}

export interface AccountReferenceData {
  accountTypes: string[];
  bankNames: string[];
  mapping: { raw: string; accountType: string; bankName: string | null }[];
}
