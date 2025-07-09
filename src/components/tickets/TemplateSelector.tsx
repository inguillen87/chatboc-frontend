import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X } from 'lucide-react';

export interface MessageTemplate {
  id: string;
  name: string;
  text: string;
  category?: string | string[];
  tags?: string[];
}

// TODO: Replace sampleTemplates with data fetched from an API or a more robust data source.
// This could also include logic for fetching templates based on ticket category or other contexts.
const sampleTemplates: MessageTemplate[] = [
  {
    id: 'tpl_greet_status',
    name: 'Saludo y Estado del Ticket',
    text: 'Hola {nombre_usuario}, gracias por contactarnos sobre tu reclamo "{ticket_asunto}". Actualmente se encuentra en estado: {ticket_estado}. ¿Podemos ayudarte con algo más específico al respecto?',
    category: ['General', 'Consulta'],
    tags: ['saludo', 'estado', 'consulta', 'bienvenida']
  },
  {
    id: 'tpl_solution_streetlight',
    name: 'Alumbrado: Solución Programada',
    text: 'Estimado/a {nombre_usuario}, le informamos que el problema de alumbrado público reportado en "{ticket_direccion}" ha sido programado para revisión y/o reparación en las próximas 48 horas hábiles. Le notificaremos cualquier novedad al respecto.',
    category: 'Alumbrado Público',
    tags: ['alumbrado', 'farola', 'luz', 'solucion', 'plazo', 'reparacion']
  },
  {
    id: 'tpl_request_more_info',
    name: 'Solicitar Más Información Detallada',
    text: 'Hola {nombre_usuario}, para poder procesar y atender mejor tu reclamo sobre "{ticket_asunto}", ¿podrías por favor proveernos con más detalles específicos sobre [EJ: ubicación exacta, desde cuándo ocurre, alguna foto si es posible]?',
    category: 'General',
    tags: ['informacion', 'detalle', 'pregunta', 'datos', 'foto']
  },
  {
    id: 'tpl_closing_resolved',
    name: 'Cierre: Reclamo Resuelto',
    text: 'Estimado/a {nombre_usuario}, nos complace informarte que tu reclamo referente a "{ticket_asunto}" ha sido marcado como resuelto. Si consideras que el problema persiste o tienes alguna otra consulta, no dudes en contactarnos nuevamente. ¡Gracias por tu paciencia y colaboración!',
    category: 'General',
    tags: ['cierre', 'resuelto', 'finalizado', 'solucionado']
  },
  {
    id: 'tpl_derivation_internal',
    name: 'Derivación a Sector Interno',
    text: 'Hola {nombre_usuario}, hemos recibido tu reclamo sobre "{ticket_asunto}" y lo hemos derivado al sector correspondiente para su gestión. Te mantendremos informado sobre los avances. Tiempo estimado de primera respuesta del sector: [PLAZO ESTIMADO].',
    category: 'General',
    tags: ['derivacion', 'interno', 'sector', 'proceso']
  },
  {
    id: 'tpl_no_pudo_contactar',
    name: 'Intento de Contacto Fallido',
    text: 'Estimado/a {nombre_usuario}, hemos intentado contactarte en relación a tu reclamo "{ticket_asunto}" para obtener/validar más información, pero no hemos podido localizarte. Por favor, contáctanos a la brevedad al [NÚMERO/MEDIO DE CONTACTO].',
    tags: ['contacto', 'fallido', 'no responde', 'llamar']
  }
];


interface TemplateSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (templateText: string) => void;
  // Optional: currentTicketData to help with contextual filtering or placeholder replacement
  // currentTicket?: Partial<Ticket>; // Assuming Ticket type from TicketsPanel
}

const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
  // currentTicket, // Placeholder for future use
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTemplates = useMemo(() => {
    if (!searchTerm.trim()) {
      return sampleTemplates;
    }
    const lowerSearchTerm = searchTerm.toLowerCase();
    return sampleTemplates.filter(template =>
      template.name.toLowerCase().includes(lowerSearchTerm) ||
      template.text.toLowerCase().includes(lowerSearchTerm) ||
      (template.tags && template.tags.some(tag => tag.toLowerCase().includes(lowerSearchTerm))) ||
      (template.category && (Array.isArray(template.category)
        ? template.category.some(cat => cat.toLowerCase().includes(lowerSearchTerm))
        : template.category.toLowerCase().includes(lowerSearchTerm)))
    );
  }, [searchTerm]);

  const handleSelect = (template: MessageTemplate) => {
    onSelectTemplate(template.text);
    onClose(); // Close modal after selection
  };

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader className="pr-10"> {/* Add padding for close button */}
          <DialogTitle>Seleccionar Plantilla de Mensaje</DialogTitle>
          <DialogDescription>
            Elige una respuesta predefinida. Puedes editarla antes de enviarla.
          </DialogDescription>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" className="absolute top-3 right-3" onClick={onClose}>
              <X className="h-5 w-5" />
              <span className="sr-only">Cerrar</span>
            </Button>
          </DialogClose>
        </DialogHeader>

        <div className="mb-4 mt-2">
          <Input
            type="text"
            placeholder="Buscar plantillas por nombre, contenido o etiqueta..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>

        <ScrollArea className="flex-1 -mx-6 px-6"> {/* Adjust padding for scrollbar */}
          {filteredTemplates.length > 0 ? (
            <div className="space-y-2 pb-4">
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  className="p-3 border rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => handleSelect(template)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleSelect(template)}
                >
                  <h4 className="font-semibold text-sm text-primary mb-0.5">{template.name}</h4>
                  <p className="text-xs text-muted-foreground line-clamp-2">{template.text}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No se encontraron plantillas que coincidan con "{searchTerm}".</p>
            </div>
          )}
        </ScrollArea>
        {/* Footer can be removed if not needed, or used for other actions */}
        {/* <DialogFooter className="mt-auto pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
        </DialogFooter> */}
      </DialogContent>
    </Dialog>
  );
};

export default TemplateSelector;
export { sampleTemplates }; // Exporting for potential direct use or modification elsewhere
