import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

interface Tenant {
  id: string;
  nombre: string;
  slug: string;
  estado: string;
  plan?: string;
  rubro?: string;
  pipeline_stage?: string; // Nuevo campo mock para el kanban
}

interface TenantPipelineKanbanProps {
  tenants: Tenant[];
  onStatusChange: (tenantId: string, newStatus: string) => void;
}

const STAGES = [
  { id: 'lead', label: 'Lead Nuevo', color: 'bg-slate-100 border-slate-200 text-slate-800' },
  { id: 'contactado', label: 'Contactado', color: 'bg-blue-50 border-blue-200 text-blue-800' },
  { id: 'demo_agendada', label: 'Demo Agendada', color: 'bg-purple-50 border-purple-200 text-purple-800' },
  { id: 'negociacion', label: 'En Negociación', color: 'bg-amber-50 border-amber-200 text-amber-800' },
  { id: 'activo', label: 'Cliente Activo', color: 'bg-emerald-50 border-emerald-200 text-emerald-800' }
];

export const TenantPipelineKanban: React.FC<TenantPipelineKanbanProps> = ({ tenants, onStatusChange }) => {
  // Estado local para optimizar el drag&drop visualmente antes de impactar API
  const [localTenants, setLocalTenants] = useState<Tenant[]>(tenants.map(t => ({
    ...t,
    pipeline_stage: t.pipeline_stage || (t.estado === 'activo' || t.estado === 'active' ? 'activo' : 'lead')
  })));

  const getStageTenants = (stageId: string) => {
     return localTenants.filter(t => t.pipeline_stage === stageId);
  };

  const onDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId) return; // Mismo stage, sin ordenamiento interno por ahora

    const newStageId = destination.droppableId;

    // Update local state immediately for snappy UX
    setLocalTenants(prev => prev.map(t =>
      t.id === draggableId ? { ...t, pipeline_stage: newStageId } : t
    ));

    // Call parent handler
    onStatusChange(draggableId, newStageId);
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex h-[600px] overflow-x-auto gap-4 p-4 bg-muted/30 rounded-xl border border-border/50 scrollbar-thin scrollbar-thumb-muted-foreground/20">
        {STAGES.map(stage => {
          const stageTenants = getStageTenants(stage.id);

          return (
            <div key={stage.id} className="flex-shrink-0 w-80 flex flex-col gap-3">
              <div className={`p-3 rounded-lg border ${stage.color} flex justify-between items-center shadow-sm`}>
                 <h3 className="font-semibold text-sm">{stage.label}</h3>
                 <Badge variant="secondary" className="bg-white/50">{stageTenants.length}</Badge>
              </div>

              <Droppable droppableId={stage.id}>
                {(provided, snapshot) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className={`flex-1 overflow-y-auto flex flex-col gap-2 p-1 rounded-lg ${snapshot.isDraggingOver ? 'bg-primary/5' : ''}`}
                  >
                     {stageTenants.length === 0 && !snapshot.isDraggingOver ? (
                        <div className="text-center text-xs text-muted-foreground py-6 border border-dashed rounded-lg bg-background/50">
                           Vacío
                        </div>
                     ) : (
                       stageTenants.map((tenant, index) => (
                         <Draggable key={tenant.id} draggableId={tenant.id} index={index}>
                            {(provided, snapshot) => (
                               <div
                                 ref={provided.innerRef}
                                 {...provided.draggableProps}
                                 {...provided.dragHandleProps}
                                 className={`p-3 bg-card border rounded-lg shadow-sm hover:border-primary/50 transition-all ${snapshot.isDragging ? 'shadow-md ring-2 ring-primary/20 rotate-1' : ''}`}
                               >
                                  <div className="flex justify-between items-start mb-2">
                                     <span className="font-medium text-sm line-clamp-1 pr-2">{tenant.nombre}</span>
                                     <Badge variant="outline" className="text-[10px] shrink-0">{tenant.plan || 'Free'}</Badge>
                                  </div>
                                  <div className="text-xs text-muted-foreground flex justify-between items-center mt-3">
                                     <span className="truncate max-w-[150px]">{tenant.slug}</span>
                                     {tenant.rubro && <span className="bg-muted px-1.5 py-0.5 rounded text-[10px] uppercase font-medium">{tenant.rubro}</span>}
                                  </div>
                               </div>
                            )}
                         </Draggable>
                       ))
                     )}
                     {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
};
