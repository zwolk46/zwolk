import { MagnifyingGlass, User, List } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Wordmark } from '@/components/common/Wordmark';
import { KbdHint } from '@/components/common/KbdHint';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';

interface TopBarProps {
  onOpenPalette: () => void;
  onOpenMobileNav: () => void;
}

export function TopBar({ onOpenPalette, onOpenMobileNav }: TopBarProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-30 h-14 border-b border-border bg-background/95 backdrop-blur',
        'grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-4 lg:px-6'
      )}
    >
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onOpenMobileNav}
          aria-label="Open navigation"
        >
          <List size={20} weight="regular" />
        </Button>
        <Wordmark />
      </div>

      <div className="mx-auto w-full max-w-xl">
        <button
          type="button"
          onClick={onOpenPalette}
          className={cn(
            'group flex h-9 w-full items-center gap-2 rounded-md border border-input bg-background px-3',
            'text-sm text-muted-foreground transition-colors duration-(--dur-1)',
            'hover:border-border hover:text-foreground/80',
            'focus-visible:outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30'
          )}
          aria-label="Open search (slash key)"
        >
          <MagnifyingGlass size={16} weight="regular" className="shrink-0" />
          <span className="grow truncate text-left">Search statutes, regs, sections…</span>
          <KbdHint>/</KbdHint>
          <KbdHint className="hidden sm:inline-flex">⌘K</KbdHint>
        </button>
      </div>

      <div className="flex items-center gap-1">
        <ThemeToggle />
        <Button variant="ghost" size="icon" aria-label="Account" disabled title="Account — coming soon">
          <User size={18} weight="regular" />
        </Button>
      </div>
    </header>
  );
}
