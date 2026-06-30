import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  House,
  Sun,
  Moon,
  Books,
  ArrowRight,
  CircleNotch,
  Gear,
} from '@phosphor-icons/react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { useJurisdictions } from '@/hooks/useJurisdictions';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import { toggleTheme, useTheme } from '@/lib/theme';
import type { CorpusMeta, SearchDoc } from '@/lib/law-data';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

const JUR_LIMIT = 8;
const SECTION_LIMIT = 12;

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const theme = useTheme();
  const { data: jurData } = useJurisdictions();

  const sectionSearch = useDebouncedSearch(query);
  const showSections = query.trim().length >= 2;

  const matchedJurs = useMemo<CorpusMeta[]>(() => {
    const all = jurData?.items ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return all.slice(0, JUR_LIMIT);
    return all.filter((m) => m.name.toLowerCase().includes(q)).slice(0, JUR_LIMIT);
  }, [jurData, query]);

  const close = () => {
    onClose();
    // Defer clearing the query so the close animation doesn't show empty state.
    setTimeout(() => setQuery(''), 200);
  };

  const go = (path: string) => {
    navigate(path);
    close();
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={(v) => !v && close()}
      title="Command palette"
      description="Search jurisdictions, sections, and actions"
    >
      <CommandInput
        placeholder="Search statutes, regs, sections, jurisdictions…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {showSections && sectionSearch.indexLoading
            ? 'Loading search index (~48 MB, one-time)…'
            : 'No results.'}
        </CommandEmpty>

        <CommandGroup heading="Actions">
          <CommandItem
            value="action toggle theme"
            onSelect={() => {
              toggleTheme();
              // keep palette open for chained actions
            }}
          >
            {theme === 'dark' ? (
              <Sun size={16} weight="regular" />
            ) : (
              <Moon size={16} weight="regular" />
            )}
            <span>Toggle theme ({theme === 'dark' ? 'light' : 'dark'})</span>
          </CommandItem>
          <CommandItem
            value="action go home"
            onSelect={() => go('/')}
          >
            <House size={16} weight="regular" />
            <span>Go home</span>
          </CommandItem>
          <CommandItem
            value="action go settings"
            onSelect={() => go('/settings')}
          >
            <Gear size={16} weight="regular" />
            <span>Settings</span>
          </CommandItem>
        </CommandGroup>

        {matchedJurs.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Jurisdictions">
              {matchedJurs.map((m) => (
                <CommandItem
                  key={m.jurisdictionId}
                  value={`jur ${m.name} ${m.jurisdictionId}`}
                  onSelect={() => go(`/j/${m.jurisdictionId}`)}
                >
                  <Books size={16} weight="regular" />
                  <span className="flex-1 truncate">{m.name}</span>
                  <span className="font-mono text-[0.7rem] tabular-nums text-muted-foreground">
                    {m.sectionCount.toLocaleString()} §
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {showSections && (
          <>
            <CommandSeparator />
            <CommandGroup heading={`Sections${sectionSearch.total ? ` · ${sectionSearch.total.toLocaleString()}` : ''}`}>
              {sectionSearch.indexLoading && (
                <CommandItem disabled value="loading">
                  <CircleNotch size={16} weight="regular" className="animate-spin" />
                  <span>Loading search index (~48 MB, one-time)…</span>
                </CommandItem>
              )}
              {!sectionSearch.indexLoading &&
                sectionSearch.results.slice(0, SECTION_LIMIT).map((doc) => (
                  <SectionResult key={doc.id} doc={doc} onSelect={(path) => go(path)} />
                ))}
              {!sectionSearch.indexLoading && sectionSearch.error && (
                <CommandItem disabled value="search-error">
                  <span className="text-danger">Search failed. Try again.</span>
                </CommandItem>
              )}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}

function SectionResult({ doc, onSelect }: { doc: SearchDoc; onSelect: (path: string) => void }) {
  const [jurId, ...rest] = doc.id.split(':');
  const splat = rest.join(':');
  const path = `/j/${jurId}/n/${splat}`;
  return (
    <CommandItem value={`section ${doc.citation} ${doc.heading} ${doc.id}`} onSelect={() => onSelect(path)}>
      <ArrowRight size={14} weight="regular" className="text-muted-foreground" />
      <div className="flex flex-col min-w-0">
        <span className="font-mono text-[0.7rem] tabular-nums text-muted-foreground truncate">
          {doc.citation}
        </span>
        <span className="text-sm truncate">{doc.heading}</span>
      </div>
    </CommandItem>
  );
}
