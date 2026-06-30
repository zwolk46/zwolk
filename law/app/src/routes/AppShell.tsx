import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { TopBar } from '@/components/shell/TopBar';
import { Sidebar } from '@/components/shell/Sidebar';
import { MobileNav } from '@/components/shell/MobileNav';
import { RightRail } from '@/components/shell/RightRail';
import { CommandPalette } from '@/components/shell/CommandPalette';

export interface AppShellContext {
  setRailContent: (node: ReactNode | null) => void;
  openPalette: () => void;
}

export function AppShell() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [railContent, setRailContent] = useState<ReactNode | null>(null);

  const openPalette = useCallback(() => setPaletteOpen(true), []);

  // Global keybindings: ⌘K / Ctrl-K opens palette; "/" opens it too unless
  // focus is in an editable element.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (e.key === '/' && !isEditableTarget(e.target)) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const ctx: AppShellContext = { setRailContent, openPalette };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopBar
        onOpenPalette={openPalette}
        onOpenMobileNav={() => setMobileNavOpen(true)}
      />
      <div className="flex">
        {/* Sidebar (desktop) — added by the Sidebar task; for now leave a placeholder slot */}
        <SidebarSlot />
        {/* Mobile drawer is wired in MobileNav task; pass-through hooks ready */}
        <MobileNavSlot open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
        <main className="flex-1 min-w-0 lg:pr-12">
          <RouteTransitions ctx={ctx} />
        </main>
      </div>
      <RightRail content={railContent} />
      <CommandPaletteSlot open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

// Keyed by pathname segment count, NOT the full pathname. That way navigating
// between two reader URLs (same depth, same shape) doesn't trigger a fade —
// only structural route changes do.
function RouteTransitions({ ctx }: { ctx: AppShellContext }) {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);
  const key = segments[0] ?? 'root';
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={key}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: [0, 0, 0, 1] }}
      >
        <Outlet context={ctx} />
      </motion.div>
    </AnimatePresence>
  );
}

function isEditableTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (t.isContentEditable) return true;
  return false;
}

// ── Slot stubs — replaced by real components in the next tasks ─────────────
// Keeping them as named functions in this file (rather than empty placeholders
// in their own files) makes the wiring obvious and removes any ambiguity about
// where they get implemented.

function SidebarSlot() {
  return (
    <div className="hidden lg:block lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] lg:w-[280px] lg:shrink-0">
      <Sidebar />
    </div>
  );
}

function MobileNavSlot(props: { open: boolean; onClose: () => void }) {
  return <MobileNav {...props} />;
}

function CommandPaletteSlot(props: { open: boolean; onClose: () => void }) {
  return <CommandPalette {...props} />;
}
