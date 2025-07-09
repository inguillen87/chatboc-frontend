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
    text: 'Hola {nombre_usuario}, gracias por contactarnos sobre tu reclamo N°{ticket_nro_ticket} ("{ticket_asunto}"). Actualmente se encuentra en estado: {ticket_estado}. ¿Podemos ayudarte con algo más específico al respecto?',
    category: ['General', 'Consulta'],
    tags: ['saludo', 'estado', 'consulta', 'bienvenida', 'nro ticket']
  },
  {
    id: 'tpl_confirm_reception',
    name: 'Confirmación de Recepción',
    text: 'Estimado/a {nombre_usuario}, hemos recibido correctamente su reclamo sobre "{ticket_asunto}" (Ticket N°{ticket_nro_ticket}). Lo estamos revisando y nos pondremos en contacto a la brevedad. Atentamente, {admin_nombre} del equipo de atención ciudadana.',
    category: 'General',
    tags: ['confirmacion', 'recepcion', 'inicio', 'nro ticket']
  },
  {
    id: 'tpl_request_patience',
    name: 'Solicitud de Paciencia',
    text: 'Hola {nombre_usuario}, estamos trabajando en su reclamo "{ticket_asunto}" (N°{ticket_nro_ticket}). Agradecemos su paciencia mientras investigamos la situación y coordinamos las acciones necesarias. Le mantendremos informado.',
    category: 'General',
    tags: ['paciencia', 'investigando', 'proceso']
  },
  {
    id: 'tpl_assigned_to_team',
    name: 'Asignado a Equipo/Sector',
    text: 'Le informamos que su reclamo "{ticket_asunto}" (N°{ticket_nro_ticket}) ha sido asignado al equipo de [NOMBRE DEL SECTOR/ÁREA] para su tratamiento. El tiempo estimado para la próxima actualización es de [PLAZO ESTIMADO]. Gracias, {admin_nombre}.',
    category: 'General',
    tags: ['asignado', 'derivado', 'equipo', 'sector']
  },
  {
    id: 'tpl_solution_streetlight',
    name: 'Alumbrado: Solución Programada',
    text: 'Estimado/a {nombre_usuario}, le informamos que el problema de alumbrado público reportado en "{ticket_direccion}" (Ticket N°{ticket_nro_ticket}) ha sido programado para revisión y/o reparación en las próximas 48-72 horas hábiles. Le notificaremos cualquier novedad al respecto.',
    category: 'Alumbrado Público',
    tags: ['alumbrado', 'farola', 'luz', 'solucion', 'plazo', 'reparacion']
  },
  {
    id: 'tpl_solution_waste',
    name: 'Residuos: Recolección Programada',
    text: 'Hola {nombre_usuario}, respecto a su reclamo por recolección de residuos en "{ticket_direccion}" (Ticket N°{ticket_nro_ticket}), hemos programado un servicio especial para la zona en las próximas 24 horas. Por favor, asegúrese de que los residuos estén accesibles.',
    category: 'Recolección de Residuos',
    tags: ['basura', 'residuos', 'recoleccion', 'solucion', 'plazo']
  },
  {
    id: 'tpl_solution_pothole',
    name: 'Bacheo: Inclusión en Plan',
    text: 'Estimado/a {nombre_usuario}, hemos registrado su solicitud por un bache en "{ticket_direccion}" (Ticket N°{ticket_nro_ticket}). Ha sido incluido en nuestro plan de bacheo y se atenderá según cronograma. Puede consultar avances en [LINK A PÁGINA DE SEGUIMIENTO SI EXISTE].',
    category: 'Calles y Veredas',
    tags: ['bache', 'calle', 'vereda', 'plan', 'reparacion']
  },
  {
    id: 'tpl_request_more_info_location',
    name: 'Info Adicional: Ubicación Precisa',
    text: 'Hola {nombre_usuario}, para atender su reclamo "{ticket_asunto}" (N°{ticket_nro_ticket}), necesitaríamos si es posible una ubicación más precisa. ¿Podría indicarnos entre qué calles se encuentra, o algún punto de referencia notable cercano a "{ticket_direccion}"? Gracias.',
    category: 'General',
    tags: ['informacion', 'ubicacion', 'direccion', 'precision']
  },
  {
    id: 'tpl_request_more_info_photo',
    name: 'Info Adicional: Solicitar Foto',
    text: 'Estimado/a {nombre_usuario}, para comprender mejor la situación de su reclamo "{ticket_asunto}" (N°{ticket_nro_ticket}), ¿sería tan amable de adjuntar una fotografía del problema si le es posible? Puede responder a este mensaje adjuntando la imagen. ¡Muchas gracias!',
    category: 'General',
    tags: ['informacion', 'foto', 'imagen', 'adjuntar', 'prueba']
  },
  {
    id: 'tpl_follow_up',
    name: 'Seguimiento del Caso',
    text: 'Estimado/a {nombre_usuario}, este es un mensaje de seguimiento sobre su reclamo N°{ticket_nro_ticket} ("{ticket_asunto}"). Seguimos trabajando en ello y esperamos tener novedades pronto. Gracias por su comprensión. Atte. {admin_nombre}.',
    category: 'General',
    tags: ['seguimiento', 'actualizacion', 'proceso']
  },
  {
    id: 'tpl_closing_resolved',
    name: 'Cierre: Reclamo Resuelto',
    text: 'Estimado/a {nombre_usuario}, nos complace informarte que tu reclamo N°{ticket_nro_ticket} referente a "{ticket_asunto}" ha sido marcado como resuelto. Si consideras que el problema persiste o tienes alguna otra consulta, no dudes en contactarnos nuevamente. ¡Gracias por tu paciencia y colaboración!',
    category: 'General',
    tags: ['cierre', 'resuelto', 'finalizado', 'solucionado']
  },
  {
    id: 'tpl_closing_no_jurisdiction',
    name: 'Cierre: Fuera de Jurisdicción',
    text: 'Estimado/a {nombre_usuario}, luego de revisar su reclamo "{ticket_asunto}" (N°{ticket_nro_ticket}), hemos determinado que el asunto reportado en "{ticket_direccion}" se encuentra fuera de nuestra jurisdicción municipal. Le recomendamos contactar a [ENTIDAD CORRESPONDIENTE].',
    category: 'General',
    tags: ['cierre', 'jurisdiccion', 'competencia', 'incorrecto']
  },
  {
    id: 'tpl_closing_insufficient_info',
    name: 'Cierre: Información Insuficiente',
    text: 'Hola {nombre_usuario}, hemos intentado contactarle varias veces para obtener más información sobre su reclamo "{ticket_asunto}" (N°{ticket_nro_ticket}) sin éxito. Dado que no contamos con los detalles necesarios para proceder, lamentablemente debemos cerrar el ticket. Si desea reabrirlo, por favor contáctenos con la información completa.',
    category: 'General',
    tags: ['cierre', 'informacion', 'faltante', 'sin respuesta']
  },
  {
    id: 'tpl_thank_you_collaboration',
    name: 'Agradecimiento por Colaboración',
    text: 'Estimado/a {nombre_usuario}, queremos agradecerle sinceramente por reportar el incidente "{ticket_asunto}" y por su colaboración. Su participación es fundamental para mejorar nuestra ciudad. Saludos, {admin_nombre}.',
    category: 'General',
    tags: ['agradecimiento', 'colaboracion', 'ciudadano']
  },
  {
    id: 'tpl_request_satisfaction_survey',
    name: 'Solicitar Encuesta de Satisfacción',
    text: 'Hola {nombre_usuario}, ya que su reclamo N°{ticket_nro_ticket} ("{ticket_asunto}") ha sido resuelto, le agradeceríamos si pudiera completar una breve encuesta de satisfacción en [LINK ENCUESTA] para ayudarnos a mejorar nuestros servicios. ¡Su opinión es muy importante!',
    category: 'General',
    tags: ['encuesta', 'satisfaccion', 'opinion', 'feedback', 'cierre']
  },
  {
    id: 'tpl_no_pudo_contactar',
    name: 'Intento de Contacto Fallido',
    text: 'Estimado/a {nombre_usuario}, hemos intentado contactarte en relación a tu reclamo N°{ticket_nro_ticket} ("{ticket_asunto}") para obtener/validar más información, pero no hemos podido localizarte. Por favor, contáctanos a la brevedad al [NÚMERO/MEDIO DE CONTACTO] o respondiendo a este mensaje.',
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

  const processedTemplates = useMemo(() => {
    // Filter templates first based on search term
    const baseFiltered = searchTerm.trim()
      ? sampleTemplates.filter(template => {
          const lowerSearchTerm = searchTerm.toLowerCase();
          return (
            template.name.toLowerCase().includes(lowerSearchTerm) ||
            template.text.toLowerCase().includes(lowerSearchTerm) ||
            (template.tags && template.tags.some(tag => tag.toLowerCase().includes(lowerSearchTerm))) ||
            (template.category &&
              (Array.isArray(template.category)
                ? template.category.some(cat => cat.toLowerCase().includes(lowerSearchTerm))
                : template.category.toLowerCase().includes(lowerSearchTerm)))
          );
        })
      : sampleTemplates;

    // Group filtered templates by category
    const grouped: Record<string, MessageTemplate[]> = {};
    baseFiltered.forEach(template => {
      let mainCategory = 'Otros'; // Default category
      if (template.category) {
        mainCategory = Array.isArray(template.category) ? template.category[0] : template.category;
      }
      if (!grouped[mainCategory]) {
        grouped[mainCategory] = [];
      }
      grouped[mainCategory].push(template);
    });

    // Sort categories, e.g., 'General' first, then alphabetically, then 'Otros' last
    const categoryOrder = ['General'];
    const sortedGrouped = Object.entries(grouped).sort(([catA], [catB]) => {
        const indexA = categoryOrder.indexOf(catA);
        const indexB = categoryOrder.indexOf(catB);

        if (catA === 'Otros') return 1; // 'Otros' always last
        if (catB === 'Otros') return -1;

        if (indexA !== -1 && indexB !== -1) return indexA - indexB; // Both in predefined order
        if (indexA !== -1) return -1; // A is in predefined order, B is not
        if (indexB !== -1) return 1;  // B is in predefined order, A is not
        return catA.localeCompare(catB); // Alphabetical for others
    });

    return sortedGrouped;
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
          {processedTemplates.length > 0 ? (
            <div className="space-y-4 pb-4">
              {processedTemplates.map(([category, templates]) => (
                <div key={category}>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2 sticky top-0 bg-content z-10 py-1 -mx-6 px-6 border-b dark:border-slate-700/80">
                    {category} ({templates.length})
                  </h3>
                  <div className="space-y-2">
                    {templates.map((template) => (
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
