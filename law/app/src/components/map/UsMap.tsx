// US map with nation → state drill. Uses d3-geo + topojson-client directly
// against the us-atlas TOPO URLs in lib/geo.js. States topojson is pre-projected
// to a 975×610 viewBox so the path generator uses no projection (null). Counties
// topojson lives at the same CDN; we fetch on drill.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { geoPath } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import type { Feature, FeatureCollection } from 'geojson';
import { CaretLeft } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { geo } from '@/lib/geoClient';
import {
  TOPO,
  stateByFips,
  stateOf,
  type CoverageStatus,
  type StateRec,
} from '../../../../lib/geo.js';
import { useCoverageSummary, useStateCoverage } from '@/hooks/useCoverage';
import { useJurisdictions } from '@/hooks/useJurisdictions';
import { cn } from '@/lib/utils';

interface Props {
  /** 'home' renders a compact preview; 'page' renders the full-screen explorer. */
  variant?: 'home' | 'page';
  /** Force-start zoomed to a specific state. */
  initialState?: string | null;
}

interface TooltipPos {
  x: number;
  y: number;
  title: string;
  detail?: string;
  status?: CoverageStatus;
}

// ── Coverage → color  ──────────────────────────────────────────────────────

function colorForStatePct(pct: number | undefined): string {
  // Default "not yet scanned" — use secondary so it's visibly distinct from
  // the card-colored map background. Muted is too close to bg in dark mode.
  if (pct == null || pct === 0) return 'var(--color-secondary)';
  if (pct >= 90) return 'var(--color-success)';
  if (pct >= 40) return 'var(--color-warning)';
  return 'var(--color-danger)';
}

function colorForPlaceStatus(status: CoverageStatus): string {
  switch (status) {
    case 'ingested':
      return 'var(--color-success)';
    case 'available':
      return 'var(--color-warning)';
    case 'gap-no-source':
    case 'gap-unprobed':
      return 'var(--color-danger)';
    case 'governed-by-parent':
      return 'var(--color-accent)';
    default:
      return 'var(--color-secondary)';
  }
}

function statusLabel(status: CoverageStatus): string {
  switch (status) {
    case 'ingested':
      return 'Ingested';
    case 'available':
      return 'Source available';
    case 'gap-no-source':
      return 'No digital source';
    case 'gap-unprobed':
      return 'Not yet scanned';
    case 'governed-by-parent':
      return 'Covered by parent jurisdiction';
    default:
      return 'Unknown';
  }
}

// ── Component ──────────────────────────────────────────────────────────────

export function UsMap({ variant = 'page', initialState = null }: Props) {
  const navigate = useNavigate();
  const { data: summary } = useCoverageSummary();
  const { data: jurData } = useJurisdictions();
  const knownJurIds = useMemo(
    () => new Set((jurData?.items ?? []).map((j) => j.jurisdictionId)),
    [jurData]
  );
  const [statesTopo, setStatesTopo] = useState<Topology | null>(null);
  const [countiesTopo, setCountiesTopo] = useState<Topology | null>(null);
  const [drilled, setDrilled] = useState<StateRec | null>(
    initialState ? stateByFips(initialState) || null : null
  );
  const [tooltip, setTooltip] = useState<TooltipPos | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Fetch nation topojson once.
  useEffect(() => {
    let cancelled = false;
    fetch(TOPO.states)
      .then((r) => r.json())
      .then((t) => {
        if (cancelled) return;
        setStatesTopo(t);
      })
      .catch(() => {
        // ignore — Skeleton stays visible
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch counties topojson lazily on first drill.
  useEffect(() => {
    if (!drilled || countiesTopo) return;
    let cancelled = false;
    fetch(TOPO.counties)
      .then((r) => r.json())
      .then((t) => {
        if (cancelled) return;
        setCountiesTopo(t);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [drilled, countiesTopo]);

  const { data: stateCoverage } = useStateCoverage(drilled?.usps ?? null);

  const path = useMemo(() => geoPath(), []);
  const stateBorders = useMemo(() => {
    if (!statesTopo) return null;
    return mesh(
      statesTopo,
      statesTopo.objects.states as unknown as Parameters<typeof mesh>[1],
      (a, b) => a !== b
    );
  }, [statesTopo]);

  // ── Render: nation view ────────────────────────────────────────────────
  const nationFeatures = useMemo<FeatureCollection | null>(() => {
    if (!statesTopo) return null;
    return feature(
      statesTopo,
      statesTopo.objects.states as unknown as Parameters<typeof feature>[1]
    ) as FeatureCollection;
  }, [statesTopo]);

  // ── Render: state view ─────────────────────────────────────────────────
  const stateCountyFeatures = useMemo<Feature[] | null>(() => {
    if (!drilled || !countiesTopo) return null;
    const all = feature(
      countiesTopo,
      countiesTopo.objects.counties as unknown as Parameters<typeof feature>[1]
    ) as FeatureCollection;
    return all.features.filter((f) => stateOf(String(f.id)) === drilled.fips);
  }, [countiesTopo, drilled]);

  const stateOutline = useMemo<Feature | null>(() => {
    if (!drilled || !statesTopo || !nationFeatures) return null;
    return (
      nationFeatures.features.find((f) => String(f.id) === drilled.fips) ?? null
    );
  }, [drilled, statesTopo, nationFeatures]);

  // Tooltip positioning helper.
  const showTooltip = (
    e: React.MouseEvent,
    title: string,
    detail?: string,
    status?: CoverageStatus
  ) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      title,
      detail,
      status,
    });
  };

  const hideTooltip = () => setTooltip(null);

  // Click handlers.
  const onStateClick = (f: Feature) => {
    const fips = String(f.id);
    const st = stateByFips(fips);
    if (!st) return;
    if (variant === 'home') {
      // From Home, jump straight to the state view at /map.
      navigate(`/map?st=${st.usps}`);
      return;
    }
    setDrilled(st);
    hideTooltip();
  };

  const onCountyClick = async (f: Feature) => {
    const fips = String(f.id);
    const jurs = await geo.jurisdictionsForFips(fips);
    const place = stateCoverage?.places.find((p) => p.fips === fips);
    // 1) Ingested jurisdiction we actually serve → navigate to its landing.
    const ingestedJurId = jurs.find((id) => knownJurIds.has(id));
    if (ingestedJurId) {
      navigate(`/j/${ingestedJurId}`);
      return;
    }
    // 2) Available source but not yet ingested — toast with the publisher link.
    if (place && place.status === 'available' && place.sourceUrl) {
      toast.info(`${place.name || `FIPS ${fips}`} — not ingested yet`, {
        description: `Source available from ${place.publisher ?? 'publisher'}. Click to open.`,
        action: {
          label: 'Open source',
          onClick: () => window.open(place.sourceUrl as string, '_blank', 'noopener,noreferrer'),
        },
      });
      return;
    }
    // 3) Gap or no info — honest message.
    toast.info(`${place?.name || `FIPS ${fips}`} — no digital code yet`, {
      description: 'No publicly-known digital code source for this place.',
    });
  };

  const containerHeight = variant === 'home' ? 'h-72 lg:h-96' : 'h-[60vh] lg:h-[72vh]';

  return (
    <div className="space-y-3">
      {variant === 'page' && drilled && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setDrilled(null);
            hideTooltip();
          }}
        >
          <CaretLeft size={14} weight="regular" />
          Back to nation
        </Button>
      )}
      <div
        ref={wrapRef}
        className={cn(
          'relative w-full rounded-lg border border-border bg-card overflow-hidden',
          containerHeight
        )}
        onMouseLeave={hideTooltip}
      >
        {!statesTopo ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Skeleton className="w-3/4 h-3/4 rounded-md" />
          </div>
        ) : !drilled ? (
          <svg
            viewBox="0 0 975 610"
            preserveAspectRatio="xMidYMid meet"
            className="w-full h-full"
            role="img"
            aria-label="US states by coverage status"
          >
            {nationFeatures?.features.map((f) => {
              const fips = String(f.id);
              const st = stateByFips(fips);
              const pct =
                (summary?.states?.[st?.usps ?? ''] as { ingested?: number })?.ingested ?? 0;
              const fill = colorForStatePct(pct);
              return (
                <path
                  key={fips}
                  d={path(f) ?? undefined}
                  fill={fill}
                  stroke="var(--color-background)"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                  className="cursor-pointer transition-opacity duration-(--dur-1) hover:opacity-80"
                  onMouseEnter={(e) =>
                    showTooltip(
                      e,
                      st?.name ?? 'Unknown',
                      pct === 0 ? 'Not yet scanned' : `${pct}% coverage`
                    )
                  }
                  onMouseMove={(e) =>
                    showTooltip(
                      e,
                      st?.name ?? 'Unknown',
                      pct === 0 ? 'Not yet scanned' : `${pct}% coverage`
                    )
                  }
                  onClick={() => onStateClick(f)}
                />
              );
            })}
            {stateBorders && (
              <path
                d={path(stateBorders) ?? undefined}
                fill="none"
                stroke="var(--color-foreground)"
                strokeOpacity={0.35}
                strokeWidth={0.8}
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            )}
          </svg>
        ) : (
          <StateView
            stateOutline={stateOutline}
            counties={stateCountyFeatures}
            statesTopo={statesTopo}
            stateRec={drilled}
            stateCoverage={stateCoverage?.places ?? []}
            onCountyHover={(e, f) => {
              const fips = String(f.id);
              const matched = stateCoverage?.places.find((p) => p.fips === fips);
              showTooltip(
                e,
                matched?.name || `FIPS ${fips}`,
                matched ? statusLabel(matched.status) : 'County',
                matched?.status
              );
            }}
            onCountyClick={onCountyClick}
            onLeave={hideTooltip}
          />
        )}
        {tooltip && (
          <div
            className="pointer-events-none absolute z-10 px-2.5 py-1.5 rounded-md border border-border bg-popover text-popover-foreground shadow-md text-xs space-y-0.5 max-w-[220px]"
            style={{
              left: Math.min(tooltip.x + 12, (wrapRef.current?.clientWidth ?? 0) - 230),
              top: Math.max(tooltip.y - 32, 4),
            }}
          >
            <p className="font-medium">{tooltip.title}</p>
            {tooltip.detail && (
              <p className="font-mono text-[0.7rem] text-muted-foreground">{tooltip.detail}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StateView({
  stateOutline,
  counties,
  stateRec,
  stateCoverage,
  onCountyHover,
  onCountyClick,
  onLeave,
}: {
  stateOutline: Feature | null;
  counties: Feature[] | null;
  statesTopo: Topology;
  stateRec: StateRec;
  stateCoverage: Array<{ fips: string; status: CoverageStatus }>;
  onCountyHover: (e: React.MouseEvent, f: Feature) => void;
  onCountyClick: (f: Feature) => void;
  onLeave: () => void;
}) {
  const path = useMemo(() => geoPath(), []);

  // Compute a tight viewBox around the state so the SVG fills the container
  // instead of showing all of CONUS at small scale.
  const viewBox = useMemo(() => {
    if (!stateOutline) return '0 0 975 610';
    const b = path.bounds(stateOutline);
    const [[x0, y0], [x1, y1]] = b;
    const pad = 8;
    return `${x0 - pad} ${y0 - pad} ${x1 - x0 + pad * 2} ${y1 - y0 + pad * 2}`;
  }, [path, stateOutline]);

  if (!counties) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <Skeleton className="w-3/4 h-3/4 rounded-md" />
      </div>
    );
  }

  // Build a quick fips → status map. County fips (5 digits) won't match place
  // fips (7 digits) directly; only places at the county level will color
  // here. Cities/places below county level appear in the coverage list but
  // aren't drawn on this map (counties topojson doesn't include them).
  const statusByFips = new Map<string, CoverageStatus>();
  for (const p of stateCoverage) statusByFips.set(p.fips, p.status);

  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      className="w-full h-full"
      role="img"
      aria-label={`${stateRec.name} counties`}
      onMouseLeave={onLeave}
    >
      {counties.map((f) => {
        const fips = String(f.id);
        const status = statusByFips.get(fips) ?? null;
        const fill = status ? colorForPlaceStatus(status) : 'var(--color-secondary)';
        return (
          <path
            key={fips}
            d={path(f) ?? undefined}
            fill={fill}
            stroke="var(--color-background)"
            strokeWidth={0.6}
            vectorEffect="non-scaling-stroke"
            className="cursor-pointer transition-opacity duration-(--dur-1) hover:opacity-80"
            onMouseEnter={(e) => onCountyHover(e, f)}
            onMouseMove={(e) => onCountyHover(e, f)}
            onClick={() => onCountyClick(f)}
          />
        );
      })}
      {stateOutline && (
        <path
          d={path(stateOutline) ?? undefined}
          fill="none"
          stroke="var(--color-foreground)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      )}
    </svg>
  );
}
