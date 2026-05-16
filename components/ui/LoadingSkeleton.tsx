import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn("skeleton rounded-xl", className)}
    />
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <Skeleton className="h-40 w-full rounded-3xl" />
      <div className="grid grid-cols-3 gap-4">
        <Skeleton className="h-24 rounded-3xl" />
        <Skeleton className="h-24 rounded-3xl" />
        <Skeleton className="h-24 rounded-3xl" />
      </div>
      <Skeleton className="h-64 w-full rounded-3xl" />
      <Skeleton className="h-48 w-full rounded-3xl" />
    </div>
  );
}
