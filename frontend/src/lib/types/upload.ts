export type ImportType = 'booking' | 'expense' | 'investor';

export interface ImportFileResult {
  fileName: string;
  skipped: boolean;
  inserted: number;
  /**
   * Expense imports only. The file was refused before anything was read —
   * currently only when its name carries no month and year, without which the
   * importer cannot validate or correct the Date column. Distinct from
   * `skipped`, which means "already imported, nothing to do".
   */
  rejected?: boolean;
}

// Mirrors the result object every scripts/lib/*Importer.js function returns
// (see scripts/BACKEND_INTEGRATION.md section 4). Bookings/expenses use the
// files/totalInserted/filesSkipped fields; investor uses the
// facilitiesProcessed/monthsInserted/disbursementsInserted fields instead —
// both always carry warnings/log, and refused/problems only appear when the
// investor validation guard rejects the workbook.
export interface ImportResult {
  ok: boolean;
  dryRun: boolean;
  refused?: boolean;
  problems?: string[];
  filesProcessed?: number;
  filesSkipped?: number;
  /** Expense imports only. Files refused outright — their data is NOT in the database. */
  filesRejected?: number;
  totalInserted?: number;
  warningCount?: number;
  files?: ImportFileResult[];
  warnings: string[];
  log?: string[];
  facilitiesProcessed?: number;
  monthsInserted?: number;
  disbursementsInserted?: number;

  /** Expense imports only. Rows whose Date cell was blank. */
  undatedCount?: number;
  /** Expense imports only. Sum of the amounts on those rows. */
  undatedTotal?: number;
  /** How blank dates were handled: 'carry' reuses the date from the row above. */
  undatedPolicy?: 'carry' | 'month-start' | 'skip';
  /**
   * Set by the server when a real (non-dry-run) expense import was refused
   * because the file has blank dates and the user has not agreed to the
   * carry-down yet. Nothing was written. Re-send with confirmUndated: true.
   */
  needsConfirmation?: boolean;
}
