import { Button } from '@/components/ui/Button';

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="card-surface flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div>
        <p className="text-sm font-medium text-ink">Couldn't load this report.</p>
        <p className="mt-1 text-sm text-ink-muted">Try again or change the selected period.</p>
      </div>
      <Button variant="secondary" onClick={onRetry} className="h-9 px-4 text-sm">
        Try again
      </Button>
    </div>
  );
}
