import React from 'react';
import { BarChart3, DollarSign } from 'lucide-react';

export const AnalyticsCostsPage: React.FC = () => {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analítica y Costos</h1>
          <p className="text-muted-foreground mt-1">Consumo de IA y servicios desglosados por canal y modelo.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <div className="p-5 border rounded-lg bg-card shadow-sm flex flex-col gap-1">
            <span className="text-sm font-medium text-muted-foreground flex items-center gap-2"><DollarSign className="w-4 h-4"/> Gasto Mensual (Estimado)</span>
            <span className="text-3xl font-bold">$42.50 USD</span>
         </div>
         <div className="p-5 border rounded-lg bg-card shadow-sm flex flex-col gap-1">
            <span className="text-sm font-medium text-muted-foreground flex items-center gap-2"><BarChart3 className="w-4 h-4"/> Tokens Procesados</span>
            <span className="text-3xl font-bold">1.2M</span>
            <span className="text-xs text-muted-foreground mt-1">~80% gpt-4o-mini</span>
         </div>
      </div>

      <div className="mt-4 p-6 border rounded-lg bg-card h-64 flex items-center justify-center text-muted-foreground">
         [Gráfico de consumo por día y canal (Widget vs WhatsApp vs Panel)]
      </div>
    </div>
  );
};
