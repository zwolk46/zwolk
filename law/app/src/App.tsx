// THROWAWAY — verification screen for the scaffold. Replaced by the real app shell next plan.

import {
  MagnifyingGlass,
  BookOpen,
  Scales,
  BookmarkSimple,
  PencilSimple,
  ListBullets,
  CaretDown,
  MapTrifold,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { DemoSwatches } from '@/components/DemoSwatches';
import { DemoTypeRamp } from '@/components/DemoTypeRamp';

function App() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Scales size={20} weight="regular" />
            <span className="font-mono text-sm tracking-tight">law.hub · scaffold</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-12 space-y-16">
        <section className="space-y-3">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Theme 1 · Law · scaffold verification
          </p>
          <h1 className="font-display text-5xl leading-tight">
            Reading rooms, not card grids.
          </h1>
          <p className="font-serif text-[1.125rem] leading-[1.65] max-w-[68ch] text-muted-foreground">
            A monochrome reading surface for federal, state, and municipal law. This page exists
            only to prove the theme tokens, fonts, icons, and components are wired correctly. The
            real app shell ships in the next plan.
          </p>
        </section>

        <DemoSwatches />

        <DemoTypeRamp />

        <section aria-labelledby="buttons-heading" className="space-y-4">
          <h2 id="buttons-heading" className="text-2xl font-semibold">
            shadcn buttons
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <Button>Save section</Button>
            <Button variant="secondary">Open TOC</Button>
            <Button variant="outline">Compare</Button>
            <Button variant="ghost">Dismiss</Button>
            <Button variant="destructive">Delete annotation</Button>
            <Button variant="link">View official source</Button>
          </div>
        </section>

        <section aria-labelledby="icons-heading" className="space-y-4">
          <h2 id="icons-heading" className="text-2xl font-semibold">
            Phosphor icons (regular weight)
          </h2>
          <div className="flex flex-wrap items-center gap-6 text-muted-foreground">
            {[MagnifyingGlass, BookOpen, Scales, BookmarkSimple, PencilSimple, ListBullets, CaretDown, MapTrifold].map(
              (Icon, i) => (
                <Icon key={i} size={24} weight="regular" />
              )
            )}
          </div>
        </section>

        <footer className="border-t border-border pt-6 pb-12">
          <p className="text-xs text-muted-foreground font-mono">
            scaffold · law-app-scaffold branch · no screens · do not deploy
          </p>
        </footer>
      </div>
    </main>
  );
}

export default App;
