import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Flame,
  Gauge,
  Layers,
  MapPin,
  RefreshCw,
  ShieldAlert,
  Star,
  Zap,
} from 'lucide-react';
import {
  getMunicipalExecutiveSummary,
  MunicipalExecutiveSummaryResponse,
  SecretariaPerformance,
  CrisisAlert,
} from '@/services/statsService';

export const ExecutiveMayorTrafficLight: React.FC = () => {
  const [data, setData] = useState<MunicipalExecutiveSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSummary = async () => {
    try {
      setRefreshing(true);
      const res = await getMunicipalExecutiveSummary();
      setData(res);
    } catch (err) {
      console.error('Error fetching executive summary:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  if (loading) {
    return (
      <div className="p-8 text-center bg-card/60 backdrop-blur-md rounded-3xl border border-border/80 shadow-sm animate-pulse">
        <Activity className="w-8 h-8 mx-auto text-primary animate-spin mb-3" />
        <p className="text-sm font-semibold text-muted-foreground">Cargando Centro de Mando Ejecutivo...</p>
      </div>
    );
  }

  const resumen = data?.semaforo_secretarias?.resumen_general;
  const ranking = data?.semaforo_secretarias?.ranking_secretarias || [];
  const sentinel = data?.centinela_crisis;
  const alertas = sentinel?.alertas_activas || [];

  return (
    <div className="space-y-6">
      {/* Alerta Temprana de Crisis (Crisis Sentinel) */}
      <AnimatePresence>
        {alertas.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-3xl border border-destructive/40 bg-gradient-to-r from-destructive/10 via-destructive/5 to-background p-5 sm:p-6 shadow-lg shadow-destructive/5"
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-destructive/15 text-destructive flex items-center justify-center font-bold">
                  <ShieldAlert className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-extrabold text-foreground tracking-tight">Centinela de Crisis Activado</h3>
                    <Badge variant="destructive" className="uppercase text-[10px] font-black tracking-wider">
                      {sentinel?.nivel_amenaza || 'ALERTA'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Detección algorítmica de anomalías en tiempo real</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchSummary}
                disabled={refreshing}
                className="rounded-xl text-xs gap-1.5 h-8"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {alertas.map((alerta) => (
                <div
                  key={alerta.alerta_id}
                  className="bg-card/80 backdrop-blur-md rounded-2xl p-4 border border-border/80 text-xs space-y-2 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-destructive" />
                      {alerta.distrito}
                    </span>
                    <Badge
                      className={
                        alerta.severidad === 'CRITICA'
                          ? 'bg-rose-500 text-white'
                          : 'bg-amber-500 text-white'
                      }
                    >
                      {alerta.reclamos_afectados} casos
                    </Badge>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">{alerta.resumen}</p>
                  <div className="bg-muted/50 p-2 rounded-xl text-[11px] font-medium text-foreground">
                    <span className="font-bold text-primary mr-1">Recomendación:</span>
                    {alerta.accion_recomendada}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Semáforo de Gestión de Secretarías */}
      <Card className="rounded-3xl border-border/80 bg-card/70 backdrop-blur-xl shadow-xl shadow-slate-200/20 dark:shadow-none overflow-hidden">
        <CardHeader className="border-b border-border/60 pb-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold shadow-inner">
                <Gauge className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-extrabold tracking-tight">
                  Semáforo de Gestión por Secretarías
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Eficiencia de resolución y cumplimiento de SLA (&lt;48hs) por área
                </p>
              </div>
            </div>

            {/* Global KPI Pills */}
            <div className="flex items-center space-x-2">
              <div className="bg-muted/70 px-3.5 py-1.5 rounded-2xl text-xs font-bold border border-border/60">
                <span className="text-muted-foreground text-[10px] uppercase block font-semibold">Resolución Global</span>
                <span className="text-foreground text-sm font-black">{resumen?.tasa_resolucion_global || 0}%</span>
              </div>
              <div className="bg-muted/70 px-3.5 py-1.5 rounded-2xl text-xs font-bold border border-border/60">
                <span className="text-muted-foreground text-[10px] uppercase block font-semibold">Total Reclamos</span>
                <span className="text-foreground text-sm font-black">{resumen?.total_reclamos || 0}</span>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ranking.map((sec, idx) => (
              <motion.div
                key={sec.secretaria}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-card/90 border border-border/80 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-extrabold text-foreground leading-tight">{sec.secretaria}</h4>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      sec.semaforo === 'green'
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        : sec.semaforo === 'yellow'
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                        : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                        sec.semaforo === 'green'
                          ? 'bg-emerald-500'
                          : sec.semaforo === 'yellow'
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                    />
                    {sec.estado_rendimiento}
                  </span>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-[11px] font-semibold text-muted-foreground mb-1">
                    <span>Tasa de Cierre</span>
                    <span className="font-bold text-foreground">{sec.porcentaje_resolucion}%</span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        sec.semaforo === 'green'
                          ? 'bg-emerald-500'
                          : sec.semaforo === 'yellow'
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${Math.min(100, sec.porcentaje_resolucion)}%` }}
                    />
                  </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/60 text-center">
                  <div className="bg-muted/40 p-2 rounded-xl">
                    <span className="text-[10px] text-muted-foreground font-semibold block">Total</span>
                    <span className="text-xs font-black text-foreground">{sec.total_reclamos}</span>
                  </div>
                  <div className="bg-muted/40 p-2 rounded-xl">
                    <span className="text-[10px] text-muted-foreground font-semibold block">Promedio</span>
                    <span className="text-xs font-black text-foreground">{sec.tiempo_promedio_horas}h</span>
                  </div>
                  <div className="bg-muted/40 p-2 rounded-xl">
                    <span className="text-[10px] text-muted-foreground font-semibold block">CSAT</span>
                    <span className="text-xs font-black text-amber-500 flex items-center justify-center gap-0.5">
                      <Star className="w-3 h-3 fill-current" />
                      {sec.csat_estimado}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ExecutiveMayorTrafficLight;
