import { useEffect, useMemo } from 'react';
import { useOutletContext, useParams } from 'react-router';
import { useNode } from '@/hooks/useNode';
import { Breadcrumb } from '@/components/reader/Breadcrumb';
import { SiblingNav } from '@/components/reader/SiblingNav';
import { ReaderHeader } from '@/components/reader/ReaderHeader';
import { ReaderBody } from '@/components/reader/ReaderBody';
import { ContainerView } from '@/components/reader/ContainerView';
import { ReaderSkeleton } from '@/components/reader/ReaderSkeleton';
import { ReaderError } from '@/components/reader/ReaderError';
import { ReaderNotFound } from '@/components/reader/ReaderNotFound';
import { ReadingRail } from '@/components/reader/ReadingRail';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { AppShellContext } from '@/routes/AppShell';

export default function Reader() {
  const { jurId } = useParams<{ jurId: string }>();
  const params = useParams();
  const splat = params['*'] ?? '';
  const ctx = useOutletContext<AppShellContext>();
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const nodeId = useMemo(() => {
    if (!jurId || !splat) return null;
    try {
      return `${jurId}:${decodeURIComponent(splat)}`;
    } catch {
      return `${jurId}:${splat}`;
    }
  }, [jurId, splat]);

  const { node, loading, error, refetch } = useNode(nodeId);

  // Publish the right-rail content to the AppShell when we have a section node.
  // Containers don't get a rail. Cleanup on unmount/route change.
  useEffect(() => {
    if (node && node.kind === 'section') {
      ctx.setRailContent(<ReadingRail node={node} variant={isDesktop ? 'desktop' : 'mobile'} />);
    } else {
      ctx.setRailContent(null);
    }
    return () => ctx.setRailContent(null);
  }, [node, isDesktop, ctx]);

  if (!jurId || !nodeId) {
    return (
      <div className="mx-auto max-w-[78ch] px-6 lg:px-10">
        <ReaderNotFound jurId={jurId ?? ''} nodeId={nodeId ?? ''} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[78ch] px-6 lg:px-10">
      {loading && <ReaderSkeleton />}
      {!loading && error && <ReaderError error={error} onRetry={refetch} />}
      {!loading && !error && !node && <ReaderNotFound jurId={jurId} nodeId={nodeId} />}
      {!loading && !error && node && node.kind === 'container' && <ContainerView node={node} />}
      {!loading && !error && node && node.kind === 'section' && (
        <>
          <div className="sticky top-14 z-20 -mx-6 lg:-mx-10 px-6 lg:px-10 bg-background/95 backdrop-blur border-b border-border py-2 flex items-center justify-between gap-3 overflow-hidden">
            <Breadcrumb crumbs={node.breadcrumb} jurId={jurId} />
            <SiblingNav
              jurId={jurId}
              parent={node.parent}
              prevSibling={node.prevSibling}
              nextSibling={node.nextSibling}
            />
          </div>
          <ReaderHeader node={node} />
          <ReaderBody node={node} />
        </>
      )}
    </div>
  );
}
