import { useRef, useState, type DragEvent } from 'react';
import { cn } from '@/lib/utils';
import { UploadCloudIcon, FileIcon, XIcon } from '@/components/ui/icons';

function formatFileSize(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function FileDropzone({
  files,
  onFilesChange,
  multiple,
  disabled,
}: {
  files: File[];
  onFilesChange: (files: File[]) => void;
  multiple: boolean;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function addFiles(fileList: FileList | null) {
    if (!fileList || disabled) return;
    const incoming = Array.from(fileList).filter((f) => f.name.toLowerCase().endsWith('.xlsx'));
    if (incoming.length === 0) return;
    onFilesChange(multiple ? [...files, ...incoming] : incoming.slice(0, 1));
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  }

  function removeFile(index: number) {
    onFilesChange(files.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'flex flex-col items-center justify-center gap-2.5 rounded-lg border-2 border-dashed px-6 py-10 text-center',
          'transition-colors duration-200 ease-[var(--ease-maidan)]',
          disabled
            ? 'cursor-not-allowed border-border opacity-50'
            : isDragging
              ? 'cursor-pointer border-blue-bright bg-blue-soft'
              : 'cursor-pointer border-border bg-surface hover:border-blue-bright/60 hover:bg-surface-muted'
        )}
      >
        <UploadCloudIcon className="h-7 w-7 text-ink-faint" />
        <div>
          <p className="text-sm font-medium text-ink">
            {multiple ? 'Click to browse or drag .xlsx files here' : 'Click to browse or drag a .xlsx file here'}
          </p>
          <p className="mt-0.5 text-xs text-ink-muted">
            {multiple ? 'You can select more than one file.' : 'One workbook only: a new file replaces the current one.'}
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          multiple={multiple}
          disabled={disabled}
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {files.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {files.map((file, i) => (
            <li
              key={`${file.name}-${i}`}
              className="flex items-center gap-2.5 rounded-md border border-border bg-surface px-3 py-2 text-sm"
            >
              <FileIcon className="h-4 w-4 shrink-0 text-ink-faint" />
              <span className="flex-1 truncate text-ink">{file.name}</span>
              <span className="shrink-0 text-xs text-ink-muted">{formatFileSize(file.size)}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  aria-label={`Remove ${file.name}`}
                  className="shrink-0 rounded-full p-1 text-ink-faint transition-colors duration-150 hover:bg-surface-muted hover:text-ink"
                >
                  <XIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
