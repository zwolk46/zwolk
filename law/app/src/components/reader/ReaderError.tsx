import { Warning } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';

interface Props {
  error: Error;
  onRetry: () => void;
}

export function ReaderError({ error, onRetry }: Props) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-24 text-center">
      <Warning size={32} weight="regular" className="text-warning" />
      <h2 className="font-sans text-lg font-semibold">Couldn't load this section</h2>
      <p className="font-mono text-xs text-muted-foreground break-all">{error.message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
