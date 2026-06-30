import { Link } from 'react-router';
import { CaretLeft, CaretRight, CaretUp } from '@phosphor-icons/react';
import type { LiteNode } from '@/lib/law-data';
import { cn } from '@/lib/utils';

interface Props {
  jurId: string;
  parent: LiteNode | null;
  prevSibling: LiteNode | null;
  nextSibling: LiteNode | null;
}

function toPath(jurId: string, id: string | null | undefined): string | null {
  if (!id) return null;
  const splat = id.includes(':') ? id.split(':')[1] : id;
  return `/j/${jurId}/n/${splat}`;
}

const baseBtn =
  'inline-flex items-center gap-1 h-7 px-2 rounded-md text-xs ' +
  'text-muted-foreground hover:text-foreground hover:bg-muted ' +
  'transition-colors duration-(--dur-1) ' +
  'aria-disabled:opacity-40 aria-disabled:pointer-events-none';

export function SiblingNav({ jurId, parent, prevSibling, nextSibling }: Props) {
  const prevPath = toPath(jurId, prevSibling?.id);
  const upPath = toPath(jurId, parent?.id);
  const nextPath = toPath(jurId, nextSibling?.id);
  return (
    <div className="flex items-center gap-1 shrink-0">
      <NavBtn path={prevPath} icon={<CaretLeft size={14} weight="regular" />} label="Prev" labelOf={prevSibling} />
      <NavBtn path={upPath} icon={<CaretUp size={14} weight="regular" />} label="Up" labelOf={parent} />
      <NavBtn path={nextPath} icon={<CaretRight size={14} weight="regular" />} label="Next" labelOf={nextSibling} reverse />
    </div>
  );
}

function NavBtn({
  path,
  icon,
  label,
  labelOf,
  reverse,
}: {
  path: string | null;
  icon: React.ReactNode;
  label: string;
  labelOf: LiteNode | null;
  reverse?: boolean;
}) {
  const enabled = !!path;
  const title = labelOf?.heading || labelOf?.designation || label;
  if (!enabled) {
    return (
      <span className={cn(baseBtn)} aria-disabled>
        {!reverse && icon}
        <span>{label}</span>
        {reverse && icon}
      </span>
    );
  }
  return (
    <Link to={path} className={baseBtn} title={title}>
      {!reverse && icon}
      <span>{label}</span>
      {reverse && icon}
    </Link>
  );
}
