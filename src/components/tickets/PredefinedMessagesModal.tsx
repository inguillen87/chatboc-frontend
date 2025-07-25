// src/components/tickets/PredefinedMessagesModal.tsx
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PredefinedMessagesModalProps {
  onSelectMessage: (message: string) => void;
  children: React.ReactNode;
}

const predefinedMessages = [
  'Hola, gracias por contactarnos. ¿En qué podemos ayudarte?',
  'Estamos revisando tu consulta y te responderemos a la brevedad.',
  '¿Podrías proporcionarnos más detalles sobre tu problema?',
  'Gracias por tu paciencia. Seguimos trabajando para resolver tu caso.',
  'Hemos resuelto tu consulta. Si tienes alguna otra pregunta, no dudes in contactarnos.',
];

const PredefinedMessagesModal: React.FC<PredefinedMessagesModalProps> = ({ onSelectMessage, children }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (message: string) => {
    onSelectMessage(message);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Mensajes predefinidos</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-72 w-full rounded-md border p-4">
          <div className="space-y-2">
            {predefinedMessages.map((message, index) => (
              <div
                key={index}
                className="p-2 rounded-md hover:bg-muted cursor-pointer"
                onClick={() => handleSelect(message)}
              >
                {message}
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default PredefinedMessagesModal;
