// THROWAWAY — verifies the theme tokens render. Deleted when the app shell ships.

type Group = { title: string; tokens: Array<{ name: string; cls: string; fg?: string }> };

const GROUPS: Group[] = [
  {
    title: 'Core',
    tokens: [
      { name: 'background', cls: 'bg-background', fg: 'text-foreground' },
      { name: 'foreground', cls: 'bg-foreground', fg: 'text-background' },
      { name: 'primary', cls: 'bg-primary', fg: 'text-primary-foreground' },
      { name: 'secondary', cls: 'bg-secondary', fg: 'text-secondary-foreground' },
      { name: 'accent', cls: 'bg-accent', fg: 'text-accent-foreground' },
      { name: 'muted', cls: 'bg-muted', fg: 'text-muted-foreground' },
      { name: 'card', cls: 'bg-card', fg: 'text-card-foreground' },
      { name: 'popover', cls: 'bg-popover', fg: 'text-popover-foreground' },
    ],
  },
  {
    title: 'Lines & focus',
    tokens: [
      { name: 'border', cls: 'bg-border' },
      { name: 'input', cls: 'bg-input' },
      { name: 'ring', cls: 'bg-ring' },
    ],
  },
  {
    title: 'Status',
    tokens: [
      { name: 'destructive', cls: 'bg-destructive', fg: 'text-destructive-foreground' },
      { name: 'success', cls: 'bg-success' },
      { name: 'success-quiet', cls: 'bg-success-quiet', fg: 'text-success' },
      { name: 'warning', cls: 'bg-warning' },
      { name: 'warning-quiet', cls: 'bg-warning-quiet', fg: 'text-warning' },
      { name: 'danger', cls: 'bg-danger' },
      { name: 'danger-quiet', cls: 'bg-danger-quiet', fg: 'text-danger' },
    ],
  },
  {
    title: 'Sidebar',
    tokens: [
      { name: 'sidebar', cls: 'bg-sidebar', fg: 'text-sidebar-foreground' },
      { name: 'sidebar-primary', cls: 'bg-sidebar-primary', fg: 'text-sidebar-primary-foreground' },
      { name: 'sidebar-accent', cls: 'bg-sidebar-accent', fg: 'text-sidebar-accent-foreground' },
      { name: 'sidebar-border', cls: 'bg-sidebar-border' },
      { name: 'sidebar-ring', cls: 'bg-sidebar-ring' },
    ],
  },
  {
    title: 'Chart',
    tokens: [
      { name: 'chart-1', cls: 'bg-chart-1' },
      { name: 'chart-2', cls: 'bg-chart-2' },
      { name: 'chart-3', cls: 'bg-chart-3' },
      { name: 'chart-4', cls: 'bg-chart-4' },
      { name: 'chart-5', cls: 'bg-chart-5' },
    ],
  },
];

export function DemoSwatches() {
  return (
    <section aria-labelledby="palette-heading" className="space-y-8">
      <h2 id="palette-heading" className="text-2xl font-semibold">
        Palette
      </h2>
      {GROUPS.map((g) => (
        <div key={g.title} className="space-y-3">
          <h3 className="text-xs uppercase tracking-widest text-muted-foreground">{g.title}</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {g.tokens.map((t) => (
              <div key={t.name} className="space-y-2">
                <div
                  className={`aspect-square rounded-md border border-border ${t.cls} ${t.fg ?? ''} flex items-end p-2`}
                >
                  {t.fg && <span className="text-[0.7rem] font-mono">{t.name}</span>}
                </div>
                {!t.fg && (
                  <p className="text-[0.7rem] font-mono text-muted-foreground truncate">{t.name}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
