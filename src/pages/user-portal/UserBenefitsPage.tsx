import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, History, Loader2, Wallet } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { apiClient } from '@/api/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useTenant } from '@/context/TenantContext';
import { usePortalContent } from '@/hooks/usePortalContent';
import { useUser } from '@/hooks/useUser';
import { PortalLoyaltySummary } from '@/types/unified';
import { buildTenantPath } from '@/utils/tenantPaths';

const UserBenefitsPage = () => {
  const { content } = usePortalContent();
  const { currentSlug } = useTenant();
  const { user } = useUser();
  const loginPath = useMemo(() => buildTenantPath('/login', currentSlug ?? undefined), [currentSlug]);
  const registerPath = useMemo(() => buildTenantPath('/portal/dashboard', currentSlug ?? undefined), [currentSlug]);

  const [loyaltyData, setLoyaltyData] = useState<PortalLoyaltySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const summary = loyaltyData || content.loyaltySummary || null;
  const rewards = useMemo(() => {
    if (summary?.availableRewards?.length) return summary.availableRewards;
    return content.catalog
      .filter((item) => {
        const marker = `${item.priceLabel || ''} ${item.category || ''} ${item.status || ''}`.toLowerCase();
        return typeof item.price === 'number' && /(pt|punto|beneficio|canje|reward)/.test(marker);
      })
      .map((item) => ({
        id: item.id,
        title: item.title,
        cost: item.price ?? 0,
        type: item.status ?? item.category ?? '',
        description: item.description,
      }));
  }, [content.catalog, summary?.availableRewards]);
  const transactions = summary?.transactions ?? [];

  useEffect(() => {
    const fetchLoyaltyDetails = async () => {
      if (!currentSlug || !user) return;
      setLoading(true);
      setError(null);
      try {
        const data = await apiClient.getLoyalty(currentSlug);
        setLoyaltyData(data);
      } catch (err) {
        console.error('Failed to fetch loyalty details', err);
        setError('No se pudieron cargar los beneficios reales de este usuario.');
      } finally {
        setLoading(false);
      }
    };

    fetchLoyaltyDetails();
  }, [currentSlug, user]);

  const handleRedeem = async (rewardId: string) => {
    if (!currentSlug) return;
    setRedeeming(rewardId);
    setError(null);
    try {
      await apiClient.redeemBenefit(currentSlug, rewardId);
      const data = await apiClient.getLoyalty(currentSlug);
      setLoyaltyData(data);
    } catch (err) {
      console.error('Redemption failed', err);
      setError('No se pudo canjear el beneficio. Intenta nuevamente o verifica tu saldo.');
    } finally {
      setRedeeming(null);
    }
  };

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Beneficios y puntos</h1>
          <p className="text-muted-foreground text-sm md:text-base max-w-3xl">
            Consulta tu saldo, canjes disponibles y movimientos vinculados a este tenant.
          </p>
        </div>
        {!user && !content.loyaltySummary && (
          <Button asChild variant="outline">
            <a href={loginPath}>Iniciar sesion</a>
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

      {summary ? (
        <Card className="border border-muted/70 shadow-sm">
          <CardHeader>
            <CardTitle>Resumen de puntos</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                <span className="text-sm text-muted-foreground">Saldo actual</span>
              </div>
              <p className="text-3xl font-semibold">{summary.points.toLocaleString()} pts</p>
            </div>
            {summary.hasParticipationMetrics ? (
              <>
                <div className="rounded-lg bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Encuestas</p>
                  <p className="text-2xl font-semibold">{summary.surveysCompleted}</p>
                </div>
                <div className="rounded-lg bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Reclamos</p>
                  <p className="text-2xl font-semibold">{summary.claimsFiled}</p>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-card/80 border border-muted/70 shadow-sm">
          <CardHeader>
            <CardTitle>Canjes disponibles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cargando beneficios...
              </div>
            ) : rewards.length > 0 ? (
              rewards.map((reward) => (
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
                      disabled={!user || !summary || summary.points < reward.cost || !!redeeming}
                      onClick={() => handleRedeem(reward.id)}
                    >
                      {redeeming === reward.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Canjear'}
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-muted/70 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                Todavia no hay beneficios publicados para este usuario.
              </div>
            )}
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground">
            {user ? 'Canjes sujetos a disponibilidad.' : (
              <a href={registerPath} className="text-primary hover:underline">
                Deja tus datos para vincular la sesion antes de canjear.
              </a>
            )}
          </CardFooter>
        </Card>

        <Card className="bg-card/80 border border-muted/70 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Historial de movimientos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {transactions.length > 0 ? (
              <div className="space-y-3">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex justify-between items-center text-sm border-b pb-2 last:border-0 last:pb-0">
                    <div>
                      <p className="font-medium">{tx.description}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {tx.date ? format(new Date(tx.date), 'd MMM yyyy', { locale: es }) : '-'}
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
                Inicia sesion para ver tu historial de transacciones.
              </div>
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  );
};

export default UserBenefitsPage;
