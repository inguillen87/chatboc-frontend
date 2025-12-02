import { useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { TopResponse } from '@/services/analyticsService';
import { WidgetFrame } from './WidgetFrame';
import { AnalyticsEmptyState } from './AnalyticsEmptyState';

interface TopTableProps {
  title: string;
  description?: string;
  data?: TopResponse;
  exportName: string;
  loading?: boolean;
}

export function TopTable({ title, description, data, exportName, loading }: TopTableProps) {
  const rows = useMemo(() => data?.items ?? [], [data]);
  return (
    <WidgetFrame title={title} description={description} csvData={rows} exportFilename={exportName}>
      <div className="max-h-72 overflow-auto">
        {loading ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            Cargando tabla...
          </div>
        ) : rows.length === 0 ? (
          <AnalyticsEmptyState className="h-32" message="No hay resultados para mostrar." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-3/4">Nombre</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.label}>
                  <TableCell className="truncate text-sm font-medium">{row.label}</TableCell>
                  <TableCell className="text-right text-sm font-semibold">{row.value.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </WidgetFrame>
  );
}
