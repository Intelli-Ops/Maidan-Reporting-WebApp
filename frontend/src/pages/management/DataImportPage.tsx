import type { ReactNode } from 'react';
import { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { SegmentedControl } from '@/components/reporting/SegmentedControl';
import { FileDropzone } from '@/components/uploads/FileDropzone';
import { ImportResultsPanel } from '@/components/uploads/ImportResultsPanel';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Banner';
import { useToast } from '@/components/ui/Toast';
import { CalendarIcon, ReceiptIcon, UserIcon } from '@/components/ui/icons';
import { ApiError } from '@/api/client';
import { uploadImport } from '@/api/uploads';
import type { ImportResult, ImportType } from '@/lib/types/upload';

const typeCopy: Record<ImportType, string> = {
  booking: 'Daily booking files. Select several days at once; files already imported are skipped automatically.',
  expense: 'Monthly expense files. Keep the original filename (e.g. "Expense - June 2026.xlsx"); the month is read from it.',
  investor: 'The single investor workbook. This replaces all investor data, so pick one file at a time.',
};

const typeIcon: Record<ImportType, ReactNode> = {
  booking: <CalendarIcon className="h-4 w-4" />,
  expense: <ReceiptIcon className="h-4 w-4" />,
  investor: <UserIcon className="h-4 w-4" />,
};

// Gradient-filled step number, matching the same brand gradient used across
// primary buttons and hero panels — turns the plain "1. / 2." text prefixes
// into a small wizard-style progress marker instead.
function StepBadge({ n }: { n: number }) {
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-heading text-[13px] font-semibold text-white"
      style={{ background: 'linear-gradient(135deg, #185FA5, #3B6D11)' }}
    >
      {n}
    </span>
  );
}

function selectionSignature(type: ImportType, files: File[]): string {
  return `${type}::${files.map((f) => `${f.name}:${f.size}:${f.lastModified}`).join('|')}`;
}

export function DataImportPage() {
  const toast = useToast();
  const [type, setType] = useState<ImportType>('booking');
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [resultSignature, setResultSignature] = useState<string | null>(null);
  const [busy, setBusy] = useState<'idle' | 'previewing' | 'confirming'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [acceptUndated, setAcceptUndated] = useState(false);

  const signature = selectionSignature(type, files);
  const isStale = result !== null && resultSignature !== signature;
  const committed = result !== null && result.ok && !result.dryRun && !result.refused && !isStale;

  // Blank Date cells are an inference, not a fact: the importer reuses the
  // date from the row above. That is almost always what the client meant, but
  // it can cover a large share of a file (81 of 208 rows, PKR 965,769 in the
  // July 2026 upload), so it needs saying out loud before anything is written.
  const undatedCount = result?.undatedCount ?? 0;
  const undatedTotal = result?.undatedTotal ?? 0;
  const needsUndatedDecision = !isStale && !committed && type === 'expense' && undatedCount > 0;

  const canConfirm =
    result !== null &&
    result.ok &&
    result.dryRun &&
    !result.refused &&
    !isStale &&
    (!needsUndatedDecision || acceptUndated);

  // The blank-date acknowledgement is cleared on every one of these: it
  // applies to the exact files that were previewed, never to whatever is
  // selected next.
  function handleTypeChange(next: ImportType) {
    setType(next);
    setFiles([]);
    setResult(null);
    setError(null);
    setAcceptUndated(false);
  }

  function handleFilesChange(next: File[]) {
    setFiles(next);
    setResult(null);
    setError(null);
    setAcceptUndated(false);
  }

  function handleReset() {
    setFiles([]);
    setResult(null);
    setError(null);
    setAcceptUndated(false);
  }

  async function runUpload(dryRun: boolean) {
    setError(null);
    if (dryRun) setAcceptUndated(false);
    setBusy(dryRun ? 'previewing' : 'confirming');
    try {
      const res = await uploadImport({ type, files, dryRun, confirmUndated: acceptUndated });
      setResult(res.data);
      setResultSignature(signature);
      // The server refuses a real expense import with blank dates unless the
      // acknowledgement came with it. Reaching here means the UI and the
      // server disagreed, so surface it rather than showing a success toast
      // for an import that wrote nothing.
      if (!dryRun && res.data.needsConfirmation) {
        setError('This file has rows with no date. Review the note below and tick the box before importing.');
      } else if (!dryRun && res.data.ok && !res.data.refused) {
        toast.show('Import complete.', 'success');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy('idle');
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Management"
        title="Data Import"
        description="Upload booking, expense, or investor workbooks. Every import previews first, and nothing is written until you confirm."
      />

      <div className="flex flex-col gap-6">
        <div className="card-surface p-7">
          <div className="flex items-center gap-3">
            <StepBadge n={1} />
            <h3 className="font-heading text-[17px] font-semibold tracking-tight text-ink">
              Choose what you're importing
            </h3>
          </div>
          <div className="mt-5">
            <SegmentedControl
              dividers
              value={type}
              onChange={handleTypeChange}
              options={[
                { value: 'booking', label: 'Bookings' },
                { value: 'expense', label: 'Expenses' },
                { value: 'investor', label: 'Investors' },
              ]}
            />
          </div>
          <div className="mt-4 flex items-start gap-2.5 rounded-lg bg-surface-muted/70 px-3.5 py-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-soft text-blue">
              {typeIcon[type]}
            </span>
            <p className="text-[13px] leading-snug text-ink-muted">{typeCopy[type]}</p>
          </div>
        </div>

        <div className="card-surface p-7">
          <div className="flex items-center gap-3">
            <StepBadge n={2} />
            <h3 className="font-heading text-[17px] font-semibold tracking-tight text-ink">
              Select {type === 'investor' ? 'the workbook' : 'file(s)'}
            </h3>
          </div>
          <div className="mt-5">
            <FileDropzone
              files={files}
              onFilesChange={handleFilesChange}
              multiple={type !== 'investor'}
              disabled={busy !== 'idle' || committed}
            />
          </div>
        </div>

        {error && <Banner variant="error">{error}</Banner>}

        {isStale && !committed && (
          <Banner variant="warning">Your file selection changed since the last preview. Preview again before confirming.</Banner>
        )}

        {needsUndatedDecision && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-5">
            <h4 className="font-heading text-[15px] font-semibold tracking-tight text-amber-900">
              {undatedCount} {undatedCount === 1 ? 'row has' : 'rows have'} no date
            </h4>
            <p className="mt-2 text-[13px] leading-relaxed text-amber-900/90">
              {undatedCount === 1 ? 'It totals' : 'They total'}{' '}
              <strong>PKR {undatedTotal.toLocaleString()}</strong>. In this workbook a blank Date usually
              means &ldquo;same day as the row above&rdquo;, so the import can fill each one in from the
              row before it. Every row still lands in the right month either way &mdash; only the exact
              day is being inferred.
            </p>

            <label className="mt-4 flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={acceptUndated}
                onChange={(e) => setAcceptUndated(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-amber-700"
              />
              <span className="text-[13px] font-medium leading-snug text-amber-900">
                Import anyway, using the date from the row above.
              </span>
            </label>

            <p className="mt-3 text-[12px] leading-snug text-amber-900/70">
              Prefer exact dates? Leave this unticked, fill the blank Date cells in the spreadsheet, and
              upload it again. Nothing has been saved yet.
            </p>
          </div>
        )}

        <div className="flex items-center gap-3">
          {!committed && (
            <Button
              variant={canConfirm ? 'secondary' : 'primary'}
              onClick={() => runUpload(true)}
              disabled={files.length === 0 || busy !== 'idle'}
              loading={busy === 'previewing'}
            >
              {canConfirm ? 'Preview again' : 'Preview import'}
            </Button>
          )}
          {!committed && canConfirm && (
            <Button variant="primary" onClick={() => runUpload(false)} loading={busy === 'confirming'}>
              Confirm &amp; import
            </Button>
          )}
          {committed && (
            <Button variant="secondary" onClick={handleReset}>
              Start a new import
            </Button>
          )}
        </div>

        {result && <ImportResultsPanel type={type} result={result} />}
      </div>
    </div>
  );
}
