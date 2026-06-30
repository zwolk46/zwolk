import type { NodeStatus } from '@/lib/law-data';
import { cn } from '@/lib/utils';

interface Props {
  status: NodeStatus;
}

export function StatusBadge({ status }: Props) {
  if (status === 'active') return null;
  const label = status[0].toUpperCase() + status.slice(1);
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 h-5 rounded-md text-xs font-medium',
        status === 'repealed' && 'bg-danger-quiet text-danger',
        status === 'reserved' && 'bg-muted text-muted-foreground'
      )}
    >
      {label}
    </span>
  );
}
