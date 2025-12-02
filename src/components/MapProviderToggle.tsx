import { useId } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { MapProvider } from "@/hooks/useMapProvider";

type MapProviderToggleProps = {
  value: MapProvider;
  onChange: (provider: MapProvider) => void;
  className?: string;
  orientation?: "horizontal" | "vertical";
  size?: "default" | "sm";
  googleAvailable?: boolean;
};

export function MapProviderToggle({
  value,
  onChange,
  className,
  orientation = "horizontal",
  size = "default",
  googleAvailable = true,
}: MapProviderToggleProps) {
  const baseId = useId();
  const mapLibreId = `${baseId}-maplibre`;
  const googleId = `${baseId}-google`;

  const labelClass = cn(
    "text-sm text-muted-foreground",
    size === "sm" && "text-xs",
  );

  const groupClass = cn(
    orientation === "horizontal" ? "flex items-center gap-3" : "flex flex-col gap-2",
    className,
  );

  return (
    <RadioGroup
      value={value}
      onValueChange={(next) => onChange(next as MapProvider)}
      className={groupClass}
    >
      <div className="flex items-center gap-2">
        <RadioGroupItem value="maplibre" id={mapLibreId} />
        <Label htmlFor={mapLibreId} className={labelClass}>
          MapLibre
        </Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="google" id={googleId} disabled={!googleAvailable} />
        <Label
          htmlFor={googleId}
          className={cn(labelClass, !googleAvailable && "text-muted-foreground/60")}
        >
          Google
        </Label>
      </div>
    </RadioGroup>
  );
}

