import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export function MarketHeaderSkeleton() {
  return (
    <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <div className="space-y-1">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-5 w-36" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-8 w-20 rounded-full" />
      </div>
    </div>
  );
}

export function MarketCatalogSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {Array.from({ length: cards }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-lg border bg-white shadow-sm">
          <Skeleton className="aspect-[4/3] w-full" />
          <div className="space-y-3 p-4">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
          <div className="border-t bg-muted/50 p-4">
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CartSummarySkeleton() {
  return (
    <div className="space-y-3 rounded-lg border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-5 w-16" />
        </div>
        <Skeleton className="h-10 w-10 rounded-full" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}
