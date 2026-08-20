import React, { Suspense } from "react";
import { cn } from "@/lib/utils";
import type { MapLibreMapProps } from "@/components/MapLibreMap";

const MapProviderMap = React.lazy(() => import("@/components/MapProviderMap"));

export default function LazyMapLibreMap(props: MapLibreMapProps) {
  return (
    <Suspense
      fallback={
        <div
          className={cn(
            "flex min-h-80 items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/30 text-sm text-muted-foreground",
            props.className,
          )}
        >
          Cargando mapa...
        </div>
      }
    >
      <MapProviderMap {...props} />
    </Suspense>
  );
}
