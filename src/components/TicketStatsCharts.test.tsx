import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const barMock = vi.fn(() => <div data-testid="bar-chart" />);

vi.mock("react-chartjs-2", () => ({
  Bar: (props: unknown) => barMock(props),
}));

vi.mock("chart.js", () => ({
  Chart: { register: vi.fn() },
  BarElement: {},
  CategoryScale: {},
  LinearScale: {},
  Tooltip: {},
  Legend: {},
  Title: {},
  Filler: {},
}));

import TicketStatsCharts, { TICKET_CHART_THEME } from "./TicketStatsCharts";

describe("TicketStatsCharts", () => {
  it("uses canvas-safe colors instead of unresolved CSS variables", () => {
    barMock.mockClear();
    render(
      <TicketStatsCharts
        charts={[{ title: "Reclamos por estado", data: { Nuevo: 4 } }]}
      />,
    );

    const props = barMock.mock.calls[0]?.[0] as {
      data: {
        datasets: Array<{
          backgroundColor: string;
          hoverBackgroundColor: string;
        }>;
      };
      options: { scales: { x: { ticks: { color: string } } } };
    };
    expect(props.data.datasets[0].backgroundColor).toBe(TICKET_CHART_THEME.bar);
    expect(props.data.datasets[0].hoverBackgroundColor).toBe(
      TICKET_CHART_THEME.barHover,
    );
    expect(props.options.scales.x.ticks.color).toBe(
      TICKET_CHART_THEME.axisText,
    );
    expect(JSON.stringify(props)).not.toContain("var(--");
  });

  it("replaces underpowered charts with an exact compact distribution", () => {
    barMock.mockClear();

    render(
      <TicketStatsCharts
        charts={[
          { title: "Por estado", data: { nuevo: 1, en_proceso: 1 } },
          { title: "Por zona", data: { sin_zona: 2 } },
        ]}
        sampleSize={2}
        contextLabel="puntos georreferenciados"
      />,
    );

    expect(
      screen.getByTestId("ticket-stats-sparse-summary"),
    ).toBeInTheDocument();
    expect(screen.getByText("2 puntos georreferenciados")).toBeInTheDocument();
    expect(screen.getByText("2. En proceso")).toBeInTheDocument();
    expect(screen.getByText("1. Sin zona")).toBeInTheDocument();
    expect(barMock).not.toHaveBeenCalled();
  });

  it("fails closed when the sample does not reach the privacy floor", () => {
    barMock.mockClear();

    render(
      <TicketStatsCharts
        charts={[{ title: "Por categoría", data: { luminaria: 2 } }]}
        sampleSize={2}
        privacyFloor={5}
      />,
    );

    expect(
      screen.getByTestId("ticket-stats-privacy-protected"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Umbral institucional: 5 casos agregados"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Luminaria")).not.toBeInTheDocument();
    expect(screen.queryByText("2 registros")).not.toBeInTheDocument();
    expect(barMock).not.toHaveBeenCalled();
  });
});
