import type { TooltipProps } from 'recharts';

export default function ChartTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];
  const label = (item as any).payload?.name ?? item.name;
  return (
    <div className="bg-background p-2 shadow-lg rounded-lg">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-sm font-bold">{item.value}</p>
    </div>
  );
}
