import { Skeleton } from '@/components/ui/skeleton';

export function ReaderSkeleton() {
  return (
    <div className="space-y-6 pt-6 pb-24">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-7 w-14" />
          <Skeleton className="h-7 w-16" />
        </div>
      </div>
      <div className="pt-6 space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="pt-4 space-y-3 max-w-[68ch]">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className={i === 7 ? 'h-4 w-1/2' : 'h-4 w-full'} />
        ))}
      </div>
    </div>
  );
}
