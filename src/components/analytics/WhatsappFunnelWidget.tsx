import React, { useEffect, useState } from 'react';
import { WidgetFrame } from '@/components/analytics/WidgetFrame';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import { getWhatsappFunnel } from '@/services/analyticsService';
import type { WhatsappFunnelResponse } from '@/services/analyticsService';

export const WhatsappFunnelWidget: React.FC<{ tenantSlug?: string }> = ({ tenantSlug }) => {
  const [data, setData] = useState<WhatsappFunnelResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getWhatsappFunnel(tenantSlug)
      .then((res) => {
        if (mounted) setData(res);
      })
      .catch((err) => {
        if (mounted) setError(err.message || 'Error cargando funnel de WhatsApp');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [tenantSlug]);

  if (loading) return <div className="p-4 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (error) return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  );

  const stages = data?.stages || [];

  return (
    <WidgetFrame title="Funnel WhatsApp" exportFilename="whatsapp-funnel" csvData={stages}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Etapa</TableHead>
            <TableHead className="text-right">Sesiones</TableHead>
            <TableHead className="text-right">Contactos Únicos</TableHead>
            <TableHead className="text-right">Conversión</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stages.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-sm text-muted-foreground text-center">
                No hay datos de funnel.
              </TableCell>
            </TableRow>
          ) : (
            stages.map((step, idx) => (
              <TableRow key={idx}>
                <TableCell className="text-sm font-medium">{step.label}</TableCell>
                <TableCell className="text-right text-sm">{step.sessions}</TableCell>
                <TableCell className="text-right text-sm">{step.unique_contacts}</TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {step.conversion_from_prev_pct !== null ? `${step.conversion_from_prev_pct}%` : '-'}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </WidgetFrame>
  );
};

export default WhatsappFunnelWidget;
