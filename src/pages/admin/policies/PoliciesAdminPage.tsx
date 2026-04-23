import React from 'react';
import { Shield, Plus, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export const PoliciesAdminPage: React.FC = () => {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Políticas y Moderación</h1>
          <p className="text-muted-foreground mt-1">Configura las reglas de bloqueo, censura y validación para la IA.</p>
        </div>
        <Button className="gap-2"><Plus className="w-4 h-4" /> Nueva Política</Button>
      </div>

      <div className="border rounded-md bg-card">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="py-3 px-4 font-medium text-muted-foreground">Nombre</th>
              <th className="py-3 px-4 font-medium text-muted-foreground">Regla</th>
              <th className="py-3 px-4 font-medium text-muted-foreground">Acción</th>
              <th className="py-3 px-4 font-medium text-muted-foreground">Estado</th>
              <th className="py-3 px-4 font-medium text-muted-foreground text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            <tr className="hover:bg-muted/50">
               <td className="py-3 px-4 font-medium flex items-center gap-2"><Shield className="w-4 h-4 text-red-500" /> Bloqueo PII Básico</td>
               <td className="py-3 px-4 text-muted-foreground">DNI, Tarjetas, Emails sin contexto</td>
               <td className="py-3 px-4"><Badge variant="destructive">Bloquear y Reportar</Badge></td>
               <td className="py-3 px-4"><Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">Activo</Badge></td>
               <td className="py-3 px-4 text-right"><Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button></td>
            </tr>
            <tr className="hover:bg-muted/50">
               <td className="py-3 px-4 font-medium flex items-center gap-2"><Shield className="w-4 h-4 text-amber-500" /> Insultos y Agresiones</td>
               <td className="py-3 px-4 text-muted-foreground">Lenguaje ofensivo en tickets públicos</td>
               <td className="py-3 px-4"><Badge variant="secondary">Redactar contenido</Badge></td>
               <td className="py-3 px-4"><Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">Activo</Badge></td>
               <td className="py-3 px-4 text-right"><Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
