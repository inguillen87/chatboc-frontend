import React, { useMemo, useState, useEffect } from 'react';
import { Gift, Medal, Star, Wallet, History, AlertCircle, Loader2 } from 'lucide-react';

import { useTenant } from '@/context/TenantContext';
import { buildTenantPath } from '@/utils/tenantPaths';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { usePortalContent } from '@/hooks/usePortalContent';
import { apiClient } from '@/api/client';
import { PortalLoyaltySummary } from '@/types/unified';
import { getDemoLoyaltySummary } from '@/utils/demoLoyalty';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const UserBenefitsPage = () => {
  const { content } = usePortalContent();
  const { currentSlug } = useTenant();
  const loginPath = useMemo(() => buildTenantPath('/login', currentSlug ?? undefined), [currentSlug]);

  // State for extended data not in initial content load
  const [loyaltyData, setLoyaltyData] = useState<PortalLoyaltySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fallback to demo data if api fails or not logged in
  const demoSummary = getDemoLoyaltySummary();

  // Combine content summary with detailed fetched data
  const summary = loyaltyData || content.loyaltySummary || demoSummary;

  useEffect(() => {
    const fetchLoyaltyDetails = async () => {
      if (!currentSlug) return;
      setLoading(true);
      try {
        const data = await apiClient.getLoyalty(currentSlug);
        setLoyaltyData(data);
      } catch (err) {
        console.error('Failed to fetch loyalty details', err);
        // Silent fail, fall back to summary from portal content
      } finally {
        setLoading(false);
      }
    };

    fetchLoyaltyDetails();
  }, [currentSlug]);

  const handleRedeem = async (rewardId: string) => {
    if (!currentSlug) return;
    setRedeeming(rewardId);
    setError(null);
    try {
      await apiClient.redeemBenefit(currentSlug, rewardId);
      // Refresh data
      const data = await apiClient.getLoyalty(currentSlug);
      setLoyaltyData(data);
    } catch (err: any) {
      console.error('Redemption failed', err);
      setError('No se pudo canjear el beneficio. Intenta nuevamente o verifica tu saldo.');
    } finally {
      setRedeeming(null);
    }
  };

  const progressToNext = Math.min(100, Math.round((summary.points / 1500) * 100));

  // Use backend rewards or fallback to hardcoded
  const rewards = summary.availableRewards && summary.availableRewards.length > 0
    ? summary.availableRewards
    : [
      { id: 'reward-01', title: 'Envío prioritario', cost: 1200, type: 'Servicio' },
      { id: 'reward-02', title: 'Bonificación del 10% en tu próximo pedido', cost: 900, type: 'Descuento' },
      { id: 'reward-03', title: 'Atención personalizada para reclamos', cost: 650, type: 'Soporte' },
    ];

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          {!loyaltyData && <p className="text-xs text-muted-foreground">Vista con datos locales</p>}
          <h1 className="text-3xl font-bold text-foreground">Beneficios y puntos</h1>
          <p className="text-muted-foreground text-sm md:text-base max-w-3xl">
            Consulta tu saldo, canjes disponibles y próximos objetivos de participación.
          </p>
        </div>
        {!loyaltyData && (
          <Button asChild variant="outline">
            <a href={loginPath}>Iniciar sesión</a>
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="border border-muted/70 shadow-sm">
        <CardHeader>
          <CardTitle>Resumen de puntos</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              <span className="text-sm text-muted-foreground">Saldo actual</span>
            </div>
            <p className="text-3xl font-semibold">{summary.points.toLocaleString()} pts</p>
            <p className="text-sm text-muted-foreground">
              Incluye encuestas ({summary.surveysCompleted}), sugerencias ({summary.suggestionsShared}) y reclamos ({summary.claimsFiled}).
            </p>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Objetivo próximo</span>
              <span>1500 pts</span>
            </div>
            <Progress value={progressToNext} />
            <p className="text-xs text-muted-foreground">Acumula gestiones y encuestas para desbloquear más beneficios.</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-card/80 border border-muted/70 shadow-sm">
          <CardHeader>
            <CardTitle>Canjes disponibles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {rewards.map((reward) => (
              <div key={reward.id} className="p-3 rounded-lg border border-muted/70 bg-muted/40 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{reward.title}</p>
                  <p className="text-xs text-muted-foreground">{reward.type}</p>
                  {reward.description && <p className="text-xs text-muted-foreground mt-1">{reward.description}</p>}
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-primary">{reward.cost} pts</p>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-1"
                    disabled={summary.points < reward.cost || !!redeeming}
                    onClick={() => handleRedeem(reward.id)}
                  >
                    {redeeming === reward.id ? <Loader2 className="h-3 w-3 animate-spin"/> : "Canjear"}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground">
             {loyaltyData ? 'Canjes sujetos a disponibilidad.' : 'Estos canjes son de ejemplo y se guardan solo en este navegador.'}
          </CardFooter>
        </Card>

        <Card className="bg-card/80 border border-muted/70 shadow-sm">
          <CardHeader>
             <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5"/>
                Historial de Movimientos
             </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {summary.transactions && summary.transactions.length > 0 ? (
               <div className="space-y-3">
                  {summary.transactions.map((tx) => (
                    <div key={tx.id} className="flex justify-between items-center text-sm border-b pb-2 last:border-0 last:pb-0">
                       <div>
                          <p className="font-medium">{tx.description}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {tx.date ? format(new Date(tx.date), "d MMM yyyy", { locale: es }) : '-'}
                          </p>
                       </div>
                       <span className={`font-bold ${tx.type === 'earned' ? 'text-green-600' : 'text-red-500'}`}>
                          {tx.type === 'earned' ? '+' : '-'}{tx.points}
                       </span>
                    </div>
                  ))}
               </div>
            ) : (
               <div className="text-center py-6 text-muted-foreground">
                  <p>No hay movimientos recientes.</p>
               </div>
            )}
          </CardContent>

          {!loyaltyData && (
             <CardFooter>
                <div className="bg-muted/30 p-3 rounded text-xs text-muted-foreground w-full">
                   Inicia sesión para ver tu historial real de transacciones.
                </div>
             </CardFooter>
          )}
        </Card>
      </div>
    </div>
  );
};

export default UserBenefitsPage;
