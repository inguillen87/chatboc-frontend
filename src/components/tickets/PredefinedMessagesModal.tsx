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
import { Input } from '@/components/ui/input';

const predefinedMessages = [
  "Hola, ¿en qué puedo ayudarte?",
  "Gracias por contactarnos. Estamos revisando tu solicitud.",
  "Tu ticket ha sido escalado a nuestro equipo de soporte.",
  "¿Podrías proporcionar más detalles sobre tu problema?",
  "Hemos resuelto tu problema. ¿Hay algo más en lo que pueda ayudarte?",
  "Gracias por tu paciencia. Estamos trabajando para resolver tu problema lo antes posible.",
];

interface PredefinedMessagesModalProps {
  children: React.ReactNode;
  onSelectMessage: (message: string) => void;
}

const PredefinedMessagesModal: React.FC<PredefinedMessagesModalProps> = ({ children, onSelectMessage }) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredMessages = predefinedMessages.filter(msg =>
    msg.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (message: string) => {
    onSelectMessage(message);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Mensajes Predefinidos</DialogTitle>
        </DialogHeader>
        <div className="p-4">
          <Input
            placeholder="Buscar mensaje..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mb-4"
          />
          <ScrollArea className="h-64">
            <div className="space-y-2">
              {filteredMessages.map((msg, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  className="w-full justify-start text-left h-auto"
                  onClick={() => handleSelect(msg)}
                >
                  {msg}
                </Button>
              ))}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PredefinedMessagesModal;
