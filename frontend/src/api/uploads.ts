import { apiRequest } from '@/api/client';
import type { ImportResult, ImportType } from '@/lib/types/upload';

export function uploadImport(input: {
  type: ImportType;
  files: File[];
  dryRun: boolean;
  /**
   * Expense imports with blank Date cells are refused server-side until the
   * user has seen how many rows are affected and agreed to the date being
   * carried down from the row above. Set once they have.
   */
  confirmUndated?: boolean;
}) {
  const formData = new FormData();
  formData.append('type', input.type);
  formData.append('dryRun', String(input.dryRun));
  if (input.confirmUndated) formData.append('confirmUndated', 'true');
  for (const file of input.files) {
    formData.append('files', file);
  }

  return apiRequest<{ success: true; data: ImportResult }>('/admin/upload', {
    method: 'POST',
    body: formData,
  });
}
