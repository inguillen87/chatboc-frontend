import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

const barMock = vi.fn(() => <div data-testid="bar-chart" />);

vi.mock('react-chartjs-2', () => ({
  Bar: (props: unknown) => barMock(props),
}));

vi.mock('chart.js', () => ({
  Chart: { register: vi.fn() },
  BarElement: {},
  CategoryScale: {},
  LinearScale: {},
  Tooltip: {},
  Legend: {},
  Title: {},
  Filler: {},
}));

import TicketStatsCharts, { TICKET_CHART_THEME } from './TicketStatsCharts';

describe('TicketStatsCharts', () => {
  it('uses canvas-safe colors instead of unresolved CSS variables', () => {
    render(<TicketStatsCharts charts={[{ title: 'Reclamos por estado', data: { Nuevo: 4 } }]} />);

    const props = barMock.mock.calls[0]?.[0] as {
      data: { datasets: Array<{ backgroundColor: string; hoverBackgroundColor: string }> };
      options: { scales: { x: { ticks: { color: string } } } };
    };
    expect(props.data.datasets[0].backgroundColor).toBe(TICKET_CHART_THEME.bar);
    expect(props.data.datasets[0].hoverBackgroundColor).toBe(TICKET_CHART_THEME.barHover);
    expect(props.options.scales.x.ticks.color).toBe(TICKET_CHART_THEME.axisText);
    expect(JSON.stringify(props)).not.toContain('var(--');
  });
});
