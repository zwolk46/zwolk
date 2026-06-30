import { useSearchParams } from 'react-router';

export default function SearchPlaceholder() {
  const [params] = useSearchParams();
  const q = params.get('q') ?? '';
  return (
    <div className="mx-auto max-w-2xl px-6 py-16 space-y-3">
      <h1 className="font-sans text-2xl font-semibold">Search</h1>
      {q ? (
        <p className="text-sm text-muted-foreground">
          Query: <span className="font-mono text-foreground">{q}</span>
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">No query.</p>
      )}
      <p className="font-mono text-xs text-muted-foreground">
        The full search results screen (ranked results, filter rail, sort) lands in a future plan.
        Use ⌘K for fast lookup in the meantime.
      </p>
    </div>
  );
}
