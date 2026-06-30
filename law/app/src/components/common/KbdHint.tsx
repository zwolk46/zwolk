import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function KbdHint({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[0.7rem] text-muted-foreground leading-none',
        className
      )}
    >
      {children}
    </kbd>
  );
}
