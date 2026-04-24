import React from 'react';
import { GitCommit } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export const PromptVersionsPage: React.FC = () => {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Versiones de Prompts</h1>
          <p className="text-muted-foreground mt-1">Historial y control de versiones del System Prompt principal.</p>
        </div>
        <Button>Crear Nueva Versión</Button>
      </div>

      <div className="border rounded-md bg-card p-4 flex flex-col gap-4">
         <div className="flex flex-col gap-2 p-4 border rounded bg-muted/20">
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-2">
                  <GitCommit className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-sm">v1.4.2 (Actual)</span>
               </div>
               <Badge variant="default" className="bg-green-600 hover:bg-green-700">En Producción</Badge>
            </div>
            <p className="text-xs text-muted-foreground">Actualizado por admin_central el 15/04/2026</p>
            <div className="mt-2 p-3 bg-muted rounded-md text-xs font-mono text-muted-foreground whitespace-pre-wrap">
               "Eres un asistente virtual municipal encargado de resolver consultas y clasificar reportes ciudadanos..."
            </div>
         </div>

         <div className="flex flex-col gap-2 p-4 border rounded bg-background opacity-60">
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-2">
                  <GitCommit className="w-4 h-4" />
                  <span className="font-semibold text-sm">v1.4.1</span>
               </div>
               <Badge variant="outline">Histórico</Badge>
            </div>
            <p className="text-xs text-muted-foreground">Actualizado por admin_central el 10/04/2026</p>
         </div>
      </div>
    </div>
  );
};
