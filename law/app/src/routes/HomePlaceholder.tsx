import { BookOpen } from '@phosphor-icons/react';

export default function HomePlaceholder() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-6 py-32 text-center text-muted-foreground">
      <BookOpen size={32} weight="regular" />
      <p className="font-sans text-sm">
        Pick a section from the sidebar, or press{' '}
        <kbd className="inline-flex h-5 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[0.7rem] leading-none">
          /
        </kbd>{' '}
        to search.
      </p>
      <p className="font-mono text-xs">
        Home (hero search · US map · shelf · changes feed) lands in a future plan.
      </p>
    </div>
  );
}
