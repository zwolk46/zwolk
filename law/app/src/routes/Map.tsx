import { useSearchParams } from 'react-router';
import { UsMap } from '@/components/map/UsMap';
import { MapLegend } from '@/components/map/MapLegend';

export default function MapRoute() {
  const [params] = useSearchParams();
  const initialState = params.get('st');

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-5">
      <header className="space-y-1">
        <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
          Map
        </p>
        <h1 className="font-sans text-2xl font-semibold tracking-tight">
          Browse US law by place
        </h1>
        <p className="text-sm text-muted-foreground max-w-prose">
          Click a state to drill into its counties. Color = coverage status. Click a covered
          county to open its jurisdiction.
        </p>
      </header>

      <UsMap variant="page" initialState={initialState} />

      <MapLegend />
    </div>
  );
}
