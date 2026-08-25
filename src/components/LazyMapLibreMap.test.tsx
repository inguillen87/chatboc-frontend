import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import LazyMapLibreMap from "@/components/LazyMapLibreMap";

vi.mock("@/components/MapProviderMap", () => ({
  default: ({
    ariaLabel,
    className,
    provider,
  }: {
    ariaLabel?: string;
    className?: string;
    provider?: string;
  }) => (
    <div
      aria-label={ariaLabel}
      className={className}
      data-provider={provider}
      data-testid="map-provider"
    />
  ),
}));

describe("LazyMapLibreMap", () => {
  it("enters the lightweight provider synchronously and forwards map props", () => {
    render(
      <LazyMapLibreMap
        ariaLabel="Mapa territorial"
        className="h-[32rem]"
        provider="maplibre"
      />,
    );

    expect(screen.getByTestId("map-provider")).toHaveAttribute(
      "aria-label",
      "Mapa territorial",
    );
    expect(screen.getByTestId("map-provider")).toHaveAttribute(
      "data-provider",
      "maplibre",
    );
    expect(screen.getByTestId("map-provider")).toHaveClass("h-[32rem]");
    expect(screen.queryByText("Cargando mapa...")).not.toBeInTheDocument();
  });
});
