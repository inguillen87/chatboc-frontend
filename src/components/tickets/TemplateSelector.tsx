import React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export interface MessageTemplate {
  id: string;
  title: string;
  text: string;
}

// Datos de ejemplo. En el futuro, esto vendría de una API.
const templates: MessageTemplate[] = [
  { id: 'saludo', title: 'Saludo inicial', text: 'Hola, gracias por contactar a nuestro equipo de soporte. Mi nombre es [TU_NOMBRE] y estoy aquí para ayudarte.' },
  { id: 'despedida', title: 'Despedida', text: 'Gracias por tu tiempo. Si no tienes más preguntas, procederé a cerrar este ticket. ¡Que tengas un buen día!' },
  { id: 'solicitud_info', title: 'Solicitud de más información', text: 'Para poder ayudarte mejor, ¿podrías proporcionarme más detalles sobre [ASUNTO]?' },
  { id: 'escalamiento', title: 'Escalamiento a otro equipo', text: 'Gracias por la información. Voy a escalar este ticket al equipo correspondiente para que puedan investigarlo más a fondo.' },
];

interface TemplateSelectorProps {
  onTemplateSelect: (templateText: string) => void;
}

const TemplateSelector: React.FC<TemplateSelectorProps> = ({ onTemplateSelect }) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="h-10 w-10 flex-shrink-0" title="Usar plantilla de mensaje">
          <Sparkles className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Plantillas de Mensajes</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {templates.map((template) => (
          <DropdownMenuItem key={template.id} onClick={() => onTemplateSelect(template.text)}>
            {template.title}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default TemplateSelector;
