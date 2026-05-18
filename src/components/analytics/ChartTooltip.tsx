import type { TooltipProps } from 'recharts';

type ChartTooltipProps = TooltipProps<number, string> & {
  payload?: Array<{
    name?: string;
    value?: number | string;
    payload?: { name?: string };
  }>;
};

export default function ChartTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];
  const label = item.payload?.name ?? item.name;
  return (
    <div className="bg-background p-2 shadow-lg rounded-lg">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-sm font-bold">{item.value}</p>
    </div>
  );
}
