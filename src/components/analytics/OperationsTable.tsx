import { useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { OperationsResponse } from '@/services/analyticsService';
import { WidgetFrame } from './WidgetFrame';
import { AnalyticsEmptyState } from './AnalyticsEmptyState';

interface OperationsTableProps {
  title: string;
  data?: OperationsResponse;
  exportName: string;
  loading?: boolean;
}

export function OperationsTable({ title, data, exportName, loading }: OperationsTableProps) {
  const rows = useMemo(() => data?.agents ?? [], [data]);
  return (
    <WidgetFrame title={title} csvData={rows} exportFilename={exportName}>
      <div className="max-h-72 overflow-auto">
        {loading ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            Calculando carga de agentes...
          </div>
        ) : rows.length === 0 ? (
          <AnalyticsEmptyState className="h-32" message="No hay agentes con actividad en este período." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agente</TableHead>
                <TableHead className="text-right">Tickets abiertos</TableHead>
                <TableHead className="text-right">Tiempo medio (min)</TableHead>
                <TableHead className="text-right">Satisfacción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.agente}>
                  <TableCell className="text-sm font-medium">{row.agente}</TableCell>
                  <TableCell className="text-right text-sm">{row.abiertos}</TableCell>
                  <TableCell className="text-right text-sm">{row.tiempoMedio.toFixed(1)}</TableCell>
                  <TableCell className="text-right text-sm">{row.satisfaccion.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </WidgetFrame>
  );
}
