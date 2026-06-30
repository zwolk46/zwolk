// THROWAWAY — verifies fonts load and the type system reads right. Deleted with App shell.

export function DemoTypeRamp() {
  return (
    <section aria-labelledby="type-heading" className="space-y-8">
      <h2 id="type-heading" className="text-2xl font-semibold">
        Typography
      </h2>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Display serif (Playfair Display) — headings only
        </p>
        <p className="font-display text-5xl leading-tight">
          The People of the State of New York
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Reading serif (Source Serif 4) — long legal passages
        </p>
        <p
          className="font-serif text-[1.125rem] leading-[1.65] max-w-[72ch]"
        >
          A person is guilty of assault in the third degree when, with intent to cause physical
          injury to another person, he causes such injury to such person or to a third person; or
          he recklessly causes physical injury to another person; or with criminal negligence, he
          causes physical injury to another person by means of a deadly weapon or a dangerous
          instrument.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          UI sans (Plus Jakarta Sans)
        </p>
        <p className="font-sans text-base">
          Sidebar groups · Search results · Settings · Reading rail · Command palette
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Mono (Geist Mono) — citations &amp; section numbers, tabular-nums
        </p>
        <p className="font-mono text-sm tabular-nums">
          N.Y. Penal Law § 120.00 · 17 U.S.C. § 107 · 40 C.F.R. § 261.4
        </p>
      </div>
    </section>
  );
}
