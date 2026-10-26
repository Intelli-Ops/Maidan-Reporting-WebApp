import type { ImportResult, ImportType } from '@/lib/types/upload';
import { Banner } from '@/components/ui/Banner';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Metric } from '@/components/reporting/Metric';
import { DataTable } from '@/components/reporting/DataTable';
import { AlertTriangleIcon } from '@/components/ui/icons';
import { formatCompactNumber } from '@/lib/format';

export function ImportResultsPanel({ type, result }: { type: ImportType; result: ImportResult }) {
  if (result.refused) {
    return (
      <div className="flex flex-col gap-4">
        <Banner variant="error">
          <p className="font-medium">This file was rejected. Nothing was changed.</p>
          <p className="mt-1 text-ink-muted">
            The workbook looked wrong, empty, or laid out differently than expected, so nothing was deleted or
            written to the database.
          </p>
        </Banner>
        {result.problems && result.problems.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {result.problems.map((p, i) => (
              <li
                key={i}
                className="flex items-start gap-2 rounded-md border border-red/20 bg-red-soft px-3 py-2 text-sm text-ink"
              >
                <AlertTriangleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red" />
                {p}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const isInvestor = type === 'investor';

  // Nothing survived: every file was refused, so no rows were written. The
  // success banner would say "Import complete. The numbers below reflect what
  // was just written to the database" directly above a warning saying the
  // opposite — and the tiles would all read 0, which looks like an empty
  // workbook rather than a refused one. The rejection banner carries the whole
  // message on its own in that case.
  const nothingImported = (result.filesRejected ?? 0) > 0 && (result.totalInserted ?? 0) === 0;

  return (
    <div className="flex flex-col gap-6">
      {!nothingImported && (
        <Banner variant={result.dryRun ? 'info' : 'success'}>
          {result.dryRun
            ? 'Preview only: nothing has been saved yet. Review the numbers below, then confirm to import for real.'
            : 'Import complete. The numbers below reflect what was just written to the database.'}
        </Banner>
      )}

      {/* Sits above the metric tiles rather than among them: a rejected file
          contributed no rows, so it is invisible in every number below and a
          run that refused every file otherwise reads as a clean import of
          zero rows. */}
      {(result.filesRejected ?? 0) > 0 && (
        <Banner variant="warning">
          {result.filesRejected === 1 ? '1 file was refused' : `${result.filesRejected} files were refused`} and
          nothing from {result.filesRejected === 1 ? 'it' : 'them'} was imported. Expense workbooks must carry the
          month and year in the file name — like <strong>Expense - June 2026.xlsx</strong> — because the importer uses
          that to check and correct the Date column. Rename and upload again; see the warnings below.
        </Banner>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {isInvestor ? (
          <>
            <div className="card-surface p-5">
              <Metric label="Facilities" value={formatCompactNumber(result.facilitiesProcessed ?? 0)} />
            </div>
            <div className="card-surface p-5">
              <Metric
                label={result.dryRun ? 'Months to import' : 'Months imported'}
                value={formatCompactNumber(result.monthsInserted ?? 0)}
              />
            </div>
            <div className="card-surface p-5">
              <Metric label="Disbursements" value={formatCompactNumber(result.disbursementsInserted ?? 0)} />
            </div>
            <div className="card-surface p-5">
              <Metric label="Warnings" value={formatCompactNumber(result.warnings.length)} />
            </div>
          </>
        ) : (
          <>
            <div className="card-surface p-5">
              <Metric
                label={result.dryRun ? 'Rows to import' : 'Rows imported'}
                value={formatCompactNumber(result.totalInserted ?? 0)}
              />
            </div>
            <div className="card-surface p-5">
              <Metric label="Files processed" value={formatCompactNumber(result.filesProcessed ?? 0)} />
            </div>
            <div className="card-surface p-5">
              <Metric label="Files already imported" value={formatCompactNumber(result.filesSkipped ?? 0)} />
            </div>
            <div className="card-surface p-5">
              <Metric label="Warnings" value={formatCompactNumber(result.warningCount ?? result.warnings.length)} />
            </div>
          </>
        )}
      </div>

      {!isInvestor && result.files && result.files.length > 0 && (
        <div className="card-surface p-7">
          <h3 className="font-heading text-[17px] font-semibold tracking-tight text-ink">Per-file breakdown</h3>
          <div className="mt-5">
            <DataTable
              columns={[
                { key: 'fileName', label: 'File', render: (r) => r.fileName },
                {
                  key: 'status',
                  label: 'Status',
                  render: (r) =>
                    r.rejected ? (
                      <StatusBadge label="Refused — rename with month & year" tone="error" />
                    ) : r.skipped ? (
                      <StatusBadge label="Already imported (skipped)" tone="neutral" />
                    ) : (
                      <StatusBadge label={result.dryRun ? 'Ready to import' : 'Imported'} tone="success" />
                    ),
                },
                {
                  key: 'inserted',
                  label: result.dryRun ? 'Rows to import' : 'Rows imported',
                  align: 'right',
                  render: (r) => formatCompactNumber(r.inserted),
                },
              ]}
              rows={result.files}
              rowKey={(r) => r.fileName}
            />
          </div>
        </div>
      )}

      {result.warnings.length > 0 && (
        <div className="card-surface p-7">
          <h3 className="font-heading text-[17px] font-semibold tracking-tight text-ink">
            Warnings ({result.warnings.length})
          </h3>
          <p className="mt-1 text-[13px] text-ink-muted">
            Rows that were skipped or auto-corrected while reading the file. Nothing else needs your attention.
          </p>
          <ul className="mt-5 flex max-h-80 flex-col gap-1.5 overflow-y-auto pr-1">
            {result.warnings.map((w, i) => (
              <li
                key={i}
                className="flex items-start gap-2 rounded-md bg-amber-soft/60 px-3 py-2 text-[13px] leading-snug text-ink"
              >
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber" />
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
