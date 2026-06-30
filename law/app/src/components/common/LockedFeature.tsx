import { Lock } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

interface Props {
  children: React.ReactNode;
  hint?: string;
  className?: string;
}

export function LockedFeature({ children, hint, className }: Props) {
  return (
    <span
      title={hint ?? 'Coming in a future plan'}
      className={cn(
        'inline-flex items-center gap-1.5 text-muted-foreground',
        className
      )}
    >
      <Lock size={12} weight="regular" className="shrink-0" />
      <span>{children}</span>
    </span>
  );
}
