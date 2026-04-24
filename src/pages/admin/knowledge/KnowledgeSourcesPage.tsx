import React from 'react';
import { Database, FileText, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export const KnowledgeSourcesPage: React.FC = () => {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fuentes de Conocimiento (RAG)</h1>
          <p className="text-muted-foreground mt-1">Administra los documentos y webs indexados para las respuestas de la IA.</p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" className="gap-2"><Globe className="w-4 h-4" /> Indexar Web</Button>
           <Button className="gap-2"><FileText className="w-4 h-4" /> Subir Documento</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <div className="p-4 border rounded-lg bg-card shadow-sm flex flex-col gap-3">
            <div className="flex items-start justify-between">
               <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-500" />
                  <span className="font-semibold text-sm">Normativa Municipal V2.pdf</span>
               </div>
               <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">Activo</Badge>
            </div>
            <div className="text-xs text-muted-foreground">
               <p>Chunks indexados: 145</p>
               <p>Última sincronización: Hoy 10:30 AM</p>
            </div>
         </div>

         <div className="p-4 border rounded-lg bg-card shadow-sm flex flex-col gap-3">
            <div className="flex items-start justify-between">
               <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-purple-500" />
                  <span className="font-semibold text-sm">Catálogo de Trámites</span>
               </div>
               <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">Activo</Badge>
            </div>
            <div className="text-xs text-muted-foreground">
               <p>Sincronización via API</p>
               <p>Última sincronización: Ayer 18:45 PM</p>
            </div>
         </div>
      </div>
    </div>
  );
};
