import React from 'react';
import { Activity, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const AuditExplorerPage: React.FC = () => {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Explorador de Auditoría</h1>
          <p className="text-muted-foreground mt-1">Traza de requests, uso de tools, moderación e interacciones del sistema.</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-2">
         <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por Correlation ID, User ID o Tipo..." className="pl-9" />
         </div>
         <Button variant="outline">Filtrar por fecha</Button>
      </div>

      <div className="border rounded-md bg-card overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="py-3 px-4 font-medium text-muted-foreground">Timestamp</th>
              <th className="py-3 px-4 font-medium text-muted-foreground">Correlation ID</th>
              <th className="py-3 px-4 font-medium text-muted-foreground">Actor</th>
              <th className="py-3 px-4 font-medium text-muted-foreground">Evento</th>
              <th className="py-3 px-4 font-medium text-muted-foreground">Detalle</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            <tr className="hover:bg-muted/50">
               <td className="py-3 px-4 text-muted-foreground">2026-04-20 14:32:01</td>
               <td className="py-3 px-4 font-mono text-xs">req_1abc23</td>
               <td className="py-3 px-4">user_891</td>
               <td className="py-3 px-4"><span className="px-2 py-1 rounded bg-blue-50 text-blue-700 font-medium text-xs">tool_call</span></td>
               <td className="py-3 px-4 text-muted-foreground truncate max-w-[200px]">fetch_municipal_kb (query: "multas")</td>
            </tr>
            <tr className="hover:bg-muted/50">
               <td className="py-3 px-4 text-muted-foreground">2026-04-20 14:32:05</td>
               <td className="py-3 px-4 font-mono text-xs">req_1abc23</td>
               <td className="py-3 px-4">system</td>
               <td className="py-3 px-4"><span className="px-2 py-1 rounded bg-red-50 text-red-700 font-medium text-xs">policy_block</span></td>
               <td className="py-3 px-4 text-muted-foreground truncate max-w-[200px]">Bloqueo PII Básico (DNI detectado)</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
