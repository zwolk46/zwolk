import { Link } from 'react-router';
import { BookOpen } from '@phosphor-icons/react';

interface Props {
  jurId: string;
  nodeId: string;
}

export function ReaderNotFound({ jurId, nodeId }: Props) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-24 text-center">
      <BookOpen size={32} weight="regular" className="text-muted-foreground" />
      <h2 className="font-sans text-lg font-semibold">Section not found</h2>
      <p className="font-mono text-xs text-muted-foreground break-all">{nodeId}</p>
      <Link to={`/j/${jurId}`} className="text-sm text-foreground underline underline-offset-4">
        Back to jurisdiction
      </Link>
    </div>
  );
}
