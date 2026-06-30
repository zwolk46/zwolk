import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router';
import { motion } from 'motion/react';
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

// Key by full pathname so the motion.div (and its Outlet child) remount on
// every URL change. Without this, navigating between two reader URLs
// (/j/X/n/A → /j/X/n/B) kept the same instance mounted and Outlet's
// reconciliation didn't propagate the new route content to the rendered tree.
// AnimatePresence with mode="wait" made this worse — dropping it entirely
// since we no longer animate exits.
function RouteTransitions({ ctx }: { ctx: AppShellContext }) {
  const location = useLocation();
  return (
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0, 0, 0, 1] }}
    >
      <Outlet context={ctx} />
    </motion.div>
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
