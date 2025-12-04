import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export const HeroSkeleton = () => (
  <Card className="overflow-hidden">
    <div className="h-48 md:h-64 w-full bg-muted relative">
      <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
      <div className="absolute bottom-0 p-6 space-y-3 w-full">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-64" />
      </div>
    </div>
  </Card>
);

export const ListSkeleton = ({ items = 3 }: { items?: number }) => (
  <div className="space-y-4">
    {Array.from({ length: items }).map((_, index) => (
      <Card key={index} className="border-muted/70 shadow-sm">
        <CardHeader>
          <Skeleton className="h-5 w-3/4" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
      </Card>
    ))}
  </div>
);

export const GridSkeleton = ({ items = 6 }: { items?: number }) => (
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {Array.from({ length: items }).map((_, index) => (
      <Card key={index} className="border-muted/70">
        <Skeleton className="h-32 w-full" />
        <CardContent className="space-y-2 pt-4">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-1/3" />
        </CardContent>
      </Card>
    ))}
  </div>
);
