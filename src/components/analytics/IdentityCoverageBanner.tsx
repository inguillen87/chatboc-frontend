import React, { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, AlertCircle, ShieldAlert } from 'lucide-react';
import { getIdentityCoverageV1 } from '@/services/analyticsService';
import type { IdentityCoverageResponseV1, IdentityCoverageAlert } from '@/types/stage4Contracts';

export const IdentityCoverageBanner: React.FC<{ tenantSlug?: string }> = ({ tenantSlug }) => {
  const [data, setData] = useState<IdentityCoverageResponseV1 | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getIdentityCoverageV1(tenantSlug).then((res) => {
      if (mounted) setData(res);
    }).catch(() => {
      if (mounted) setError(true);
    }).finally(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, [tenantSlug]);

  if (loading || error || !data || data.alert_count === 0) return null;

  return (
    <div className="mb-4">
      {data.alerts.map((alert, idx) => (
        <Alert key={idx} variant="destructive" className="mb-2 bg-red-50 border-red-200">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Alerta de Identidad en {alert.channel}</AlertTitle>
          <AlertDescription>
            Cobertura de identidad por debajo del objetivo. Actual: {alert.coverage_pct}%. Objetivo: {alert.target_pct}%. (Brecha: {alert.gap_pct}%)
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
};

export default IdentityCoverageBanner;
