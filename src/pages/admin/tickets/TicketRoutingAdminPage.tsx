import React, { useState } from 'react';
import { Route, Plus, Trash2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const TicketRoutingAdminPage: React.FC = () => {
  const [rules, setRules] = useState([
    { id: 1, category: 'Vialidad', zone: 'Zona Norte', assignee: 'equipo_a' },
    { id: 2, category: 'Luminarias', zone: 'Todas', assignee: 'empleado_b' },
  ]);

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Enrutamiento de Tickets</h1>
          <p className="text-muted-foreground mt-1">Configura asignaciones automáticas por categoría y zona.</p>
        </div>
        <Button className="gap-2"><Save className="w-4 h-4" /> Guardar Reglas</Button>
      </div>

      <div className="bg-card border rounded-md p-4">
         <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-4 mb-4 font-medium text-sm text-muted-foreground px-2">
            <div>Categoría</div>
            <div>Zona (Barrio/Distrito)</div>
            <div>Asignar a</div>
            <div className="w-8"></div>
         </div>

         <div className="flex flex-col gap-3">
            {rules.map((rule, idx) => (
               <div key={rule.id} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-4 items-center bg-muted/20 p-2 rounded border border-transparent hover:border-muted-foreground/20 transition-colors">
                  <Select defaultValue={rule.category}>
                    <SelectTrigger className="bg-background"><SelectValue placeholder="Categoría..." /></SelectTrigger>
                    <SelectContent>
                       <SelectItem value="Vialidad">Vialidad (Baches, Calles)</SelectItem>
                       <SelectItem value="Luminarias">Luminarias</SelectItem>
                       <SelectItem value="Limpieza">Limpieza y Recolección</SelectItem>
                       <SelectItem value="Comercio">Atención Comercial</SelectItem>
                       <SelectItem value="Todas">Cualquier Categoría</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select defaultValue={rule.zone}>
                    <SelectTrigger className="bg-background"><SelectValue placeholder="Zona..." /></SelectTrigger>
                    <SelectContent>
                       <SelectItem value="Zona Norte">Zona Norte</SelectItem>
                       <SelectItem value="Zona Sur">Zona Sur</SelectItem>
                       <SelectItem value="Zona Centro">Zona Centro</SelectItem>
                       <SelectItem value="Todas">Cualquier Zona</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select defaultValue={rule.assignee}>
                    <SelectTrigger className="bg-background"><SelectValue placeholder="Empleado / Equipo..." /></SelectTrigger>
                    <SelectContent>
                       <SelectItem value="equipo_a">Equipo A (Cuadrilla)</SelectItem>
                       <SelectItem value="empleado_b">Empleado B (Supervisor)</SelectItem>
                       <SelectItem value="cola_comercial">Cola Comercial</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-red-600 hover:bg-red-50">
                     <Trash2 className="w-4 h-4" />
                  </Button>
               </div>
            ))}
         </div>

         <Button variant="outline" className="w-full mt-4 border-dashed gap-2">
            <Plus className="w-4 h-4" /> Agregar Regla de Asignación
         </Button>
      </div>

      <div className="p-4 bg-blue-50 border border-blue-100 rounded-md text-sm text-blue-800 flex gap-3">
         <Route className="w-5 h-5 shrink-0 mt-0.5 text-blue-600" />
         <div>
            <p className="font-medium mb-1">¿Cómo funcionan las reglas?</p>
            <p className="text-blue-700/90 leading-relaxed">
               Cuando un nuevo ticket ingresa al sistema, se evalúan estas reglas de arriba hacia abajo.
               La primera regla que coincida con la categoría y zona del ticket determinará a quién se le asigna automáticamente.
               Si ninguna coincide, el ticket quedará "Sin asignar" en la bandeja general.
            </p>
         </div>
      </div>
    </div>
  );
};
