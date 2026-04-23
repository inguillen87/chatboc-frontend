import React, { useState, useEffect } from 'react';
import { Sparkles, TrendingUp, TrendingDown, AlertTriangle, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface AIInsight {
  id: string;
  type: 'positive' | 'negative' | 'warning' | 'info';
  title: string;
  description: string;
}

export const AIAssistedInsights: React.FC = () => {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock data fetching for FE-13 (Resúmenes IA en panel)
    const timer = setTimeout(() => {
      setInsights([
        {
          id: '1',
          type: 'warning',
          title: 'Aumento de reclamos',
          description: 'Subieron los reclamos de luminarias un 34% en las últimas 48 horas, principalmente en Zona Norte.'
        },
        {
          id: '2',
          type: 'negative',
          title: 'Caída de SLA',
          description: 'La Zona Oeste presenta el peor tiempo de primera respuesta (FRT) con un promedio de 14 horas.'
        },
        {
          id: '3',
          type: 'positive',
          title: 'Deflection Rate Óptimo',
          description: 'El copiloto de IA resolvió el 42% de las consultas frecuentes sin requerir intervención humana este mes.'
        }
      ]);
      setLoading(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  const getIcon = (type: string) => {
     switch (type) {
        case 'positive': return <TrendingUp className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />;
        case 'negative': return <TrendingDown className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />;
        case 'warning': return <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />;
        default: return <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />;
     }
  };

  const getBgColor = (type: string) => {
     switch (type) {
        case 'positive': return 'bg-green-50/50 border-green-100';
        case 'negative': return 'bg-red-50/50 border-red-100';
        case 'warning': return 'bg-amber-50/50 border-amber-100';
        default: return 'bg-blue-50/50 border-blue-100';
     }
  };

  return (
    <div className="flex flex-col gap-4 border rounded-xl bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 border-b pb-3">
        <Sparkles className="w-5 h-5 text-indigo-500" />
        <h2 className="text-base font-semibold tracking-tight">Resumen Ejecutivo Inteligente</h2>
        <Badge variant="secondary" className="ml-auto text-[10px] bg-indigo-100 text-indigo-800">IA Activa</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        {loading ? (
          <>
             <Skeleton className="h-24 w-full rounded-lg" />
             <Skeleton className="h-24 w-full rounded-lg" />
             <Skeleton className="h-24 w-full rounded-lg" />
          </>
        ) : (
          <AnimatePresence>
            {insights.map((insight, idx) => (
              <motion.div
                 key={insight.id}
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
                 transition={{ delay: idx * 0.1 }}
                 className={`flex items-start gap-3 p-4 rounded-lg border ${getBgColor(insight.type)}`}
              >
                 {getIcon(insight.type)}
                 <div className="flex flex-col gap-1">
                    <h3 className="font-medium text-sm text-foreground">{insight.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{insight.description}</p>
                 </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};
