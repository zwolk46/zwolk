import { Link } from 'react-router';
import type { LiteNode } from '@/lib/law-data';

interface Props {
  crumbs: LiteNode[];
  jurId: string;
}

function levelLabel(structureType: string | null | undefined): string {
  if (!structureType) return '';
  return structureType[0].toUpperCase() + structureType.slice(1);
}

export function Breadcrumb({ crumbs, jurId }: Props) {
  if (!crumbs.length) return null;
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs overflow-hidden">
      <ol className="flex items-center gap-1 truncate">
        {crumbs.map((crumb, i) => {
          const splat = crumb.id.includes(':') ? crumb.id.split(':')[1] : crumb.id;
          const path = `/j/${jurId}/n/${splat}`;
          const label =
            crumb.structureType && crumb.designation
              ? `${levelLabel(crumb.structureType)} ${crumb.designation}`
              : crumb.heading || crumb.id;
          return (
            <li key={crumb.id} className="flex items-center gap-1 min-w-0">
              <Link
                to={path}
                className="font-mono text-muted-foreground hover:text-foreground transition-colors duration-(--dur-1) truncate"
                title={crumb.heading || undefined}
              >
                {label}
              </Link>
              {i < crumbs.length - 1 && (
                <span className="text-muted-foreground/60" aria-hidden>
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
