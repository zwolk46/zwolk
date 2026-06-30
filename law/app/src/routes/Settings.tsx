import { Sun, Moon, Lock, CaretRight, ArrowSquareOut } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  useReaderDisplayOptions,
  type ReaderFontSize,
  type ReaderMeasure,
} from '@/hooks/useReaderDisplayOptions';
import { useSidebarState } from '@/hooks/useSidebarState';
import { useJurisdictions } from '@/hooks/useJurisdictions';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';

const FONT_SIZES: ReaderFontSize[] = [14, 16, 18, 20];
const MEASURES: ReaderMeasure[] = [60, 68, 78];

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 pb-10 border-b border-border last:border-b-0">
      <div className="space-y-1">
        <h2 className="font-sans text-lg font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function SegmentedControl<T extends number | string>({
  options,
  value,
  onChange,
  formatLabel,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  formatLabel?: (v: T) => string;
}) {
  return (
    <div role="radiogroup" className="inline-flex border border-border rounded-md overflow-hidden">
      {options.map((o) => (
        <button
          key={String(o)}
          role="radio"
          aria-checked={value === o}
          onClick={() => onChange(o)}
          className={cn(
            'h-8 px-3 text-xs font-mono tabular-nums transition-colors duration-(--dur-1)',
            value === o
              ? 'bg-primary text-primary-foreground'
              : 'bg-background text-foreground hover:bg-muted'
          )}
        >
          {formatLabel ? formatLabel(o) : String(o)}
        </button>
      ))}
    </div>
  );
}

export default function Settings() {
  const theme = useTheme();
  const { fontSize, measure, setFontSize, setMeasure } = useReaderDisplayOptions();
  const { expandedGroups, toggleGroup } = useSidebarState();
  const { data: jurData } = useJurisdictions();

  const corpora = Array.from(new Set((jurData?.items ?? []).map((m) => m.corpus)));

  return (
    <div className="mx-auto max-w-2xl px-6 py-12 space-y-10">
      <header className="space-y-1">
        <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
          Settings
        </p>
        <h1 className="font-sans text-3xl font-semibold tracking-tight">Settings</h1>
      </header>

      <Section
        title="Appearance"
        description="Theme + reading typography. Reader prefs apply to every section."
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Theme</p>
            <p className="text-xs text-muted-foreground capitalize">{theme}</p>
          </div>
          <div className="flex items-center gap-2">
            {theme === 'dark' ? (
              <Sun size={16} weight="regular" className="text-muted-foreground" />
            ) : (
              <Moon size={16} weight="regular" className="text-muted-foreground" />
            )}
            <ThemeToggle />
          </div>
        </div>
        <Separator />
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Reader font size</p>
            <p className="text-xs text-muted-foreground">Source Serif 4, in pixels</p>
          </div>
          <SegmentedControl
            options={FONT_SIZES}
            value={fontSize}
            onChange={setFontSize}
            formatLabel={(v) => String(v)}
          />
        </div>
        <Separator />
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Reader measure</p>
            <p className="text-xs text-muted-foreground">Body width in characters</p>
          </div>
          <SegmentedControl
            options={MEASURES}
            value={measure}
            onChange={setMeasure}
            formatLabel={(v) => `${v}ch`}
          />
        </div>
      </Section>

      <Section
        title="Sidebar"
        description="Which corpus groups expand by default in the jurisdiction tree."
      >
        <ul className="divide-y divide-border">
          {[
            { key: 'us-usc', label: 'Federal · U.S. Code' },
            { key: 'us-cfr', label: 'Federal · CFR' },
          ].map((g) => {
            const on = expandedGroups.has(g.key);
            return (
              <li key={g.key} className="flex items-center justify-between py-3">
                <span className="text-sm">{g.label}</span>
                <button
                  onClick={() => toggleGroup(g.key)}
                  className={cn(
                    'h-7 px-3 text-xs rounded-md transition-colors duration-(--dur-1)',
                    on
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-accent'
                  )}
                  aria-pressed={on}
                >
                  {on ? 'Expanded' : 'Collapsed'}
                </button>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section
        title="Data sources"
        description="Where Law Hub's text comes from. Sources are public-domain or open-licensed; the app stores them as a normalized read tree behind your auth."
      >
        <ul className="divide-y divide-border">
          {corpora.map((c) => {
            const sample = jurData?.items.find((m) => m.corpus === c);
            const sourceLabel =
              c === 'us-usc'
                ? 'Office of Law Revision Counsel (uscode.house.gov)'
                : c === 'us-cfr'
                ? 'Office of the Federal Register (ecfr.gov)'
                : sample?.sourceUrl
                ? new URL(sample.sourceUrl).hostname
                : 'Unknown';
            const count = jurData?.items.filter((m) => m.corpus === c).length ?? 0;
            return (
              <li key={c} className="py-3 flex items-baseline justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium font-mono">{c}</p>
                  <p className="text-xs text-muted-foreground truncate">{sourceLabel}</p>
                </div>
                <span className="font-mono text-xs tabular-nums text-muted-foreground shrink-0">
                  {count} titles
                </span>
              </li>
            );
          })}
        </ul>
        {jurData && (
          <p className="text-xs text-muted-foreground pt-2">
            <a
              href="https://uscode.house.gov"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 hover:text-foreground inline-flex items-center gap-1"
            >
              uscode.house.gov <ArrowSquareOut size={12} weight="regular" />
            </a>
            {' · '}
            <a
              href="https://www.ecfr.gov"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 hover:text-foreground inline-flex items-center gap-1"
            >
              ecfr.gov <ArrowSquareOut size={12} weight="regular" />
            </a>
            {' · all data public-domain (17 U.S.C. § 105 for federal works).'}
          </p>
        )}
      </Section>

      <Section
        title="Account & sync"
        description="Per-user accounts, password reset, MFA, and shared notes across devices."
      >
        <div className="flex items-start gap-3 p-3 rounded-md bg-muted/40 border border-border">
          <Lock size={18} weight="regular" className="text-muted-foreground mt-0.5 shrink-0" />
          <div className="space-y-1 flex-1">
            <p className="text-sm font-medium">Sign-in and shared notes are coming</p>
            <p className="text-xs text-muted-foreground">
              You're currently authenticated via the shared site password. Per-user accounts (with
              per-user notes synced across devices) land in a future plan. Your saved sections and
              notes today live in this browser's storage.
            </p>
          </div>
        </div>
        <div className="text-xs text-muted-foreground space-y-1">
          <p>
            Plan: <span className="font-mono">Free</span> (single-user, browser-local notes)
          </p>
        </div>
      </Section>

      <Section title="Navigation">
        <ul className="space-y-1">
          {[
            { to: '/library', label: 'Library' },
            { to: '/annotations', label: 'Annotations' },
            { to: '/coverage', label: 'Coverage' },
            { to: '/', label: 'Home' },
          ].map((l) => (
            <li key={l.to}>
              <a
                href={l.to}
                className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted transition-colors duration-(--dur-1)"
              >
                <span className="text-sm">{l.label}</span>
                <CaretRight size={14} weight="regular" className="text-muted-foreground" />
              </a>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="About"
        description="Law Hub — federal statutes and regulations; state and municipal codes coming."
      >
        <Button variant="outline" size="sm" asChild>
          <a href="/api/logout" rel="nofollow">
            Sign out
          </a>
        </Button>
      </Section>
    </div>
  );
}
