interface Props {
  className?: string;
}

const ITEMS = [
  { label: 'Ingested', color: 'var(--color-success)' },
  { label: 'Available', color: 'var(--color-warning)' },
  { label: 'Gap', color: 'var(--color-danger)' },
  { label: 'Not yet scanned', color: 'var(--color-muted)' },
];

export function MapLegend({ className }: Props) {
  return (
    <div
      className={`inline-flex flex-wrap items-center gap-x-4 gap-y-2 text-xs ${className ?? ''}`}
      aria-label="Coverage legend"
    >
      {ITEMS.map((it) => (
        <div key={it.label} className="inline-flex items-center gap-1.5">
          <span
            className="w-3 h-3 rounded-sm border border-border"
            style={{ backgroundColor: it.color }}
          />
          <span className="text-muted-foreground">{it.label}</span>
        </div>
      ))}
    </div>
  );
}
