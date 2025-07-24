import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PlusCircle, Edit, Trash2 } from 'lucide-react';

interface PredefinedMessage {
  id: string;
  title: string;
  message: string;
}

// Mock data for predefined messages
const mockMessages: PredefinedMessage[] = [
  { id: '1', title: 'Saludo inicial', message: 'Hola, gracias por contactarnos. ¿En qué podemos ayudarte?' },
  { id: '2', title: 'Solicitud de número de pedido', message: 'Para poder ayudarte, ¿podrías indicarnos tu número de pedido?' },
  { id: '3', title: 'Despedida', message: 'Gracias por contactarnos. Si tienes alguna otra pregunta, no dudes en consultarnos.' },
];

interface PredefinedMessagesModalProps {
  onSelectMessage: (message: string) => void;
  children: React.ReactNode;
}

const PredefinedMessagesModal: React.FC<PredefinedMessagesModalProps> = ({ onSelectMessage, children }) => {
    const [messages, setMessages] = useState<PredefinedMessage[]>(mockMessages);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [currentMessage, setCurrentMessage] = useState<Partial<PredefinedMessage>>({});

    const handleSave = () => {
        if(currentMessage.id) {
            setMessages(messages.map(m => m.id === currentMessage.id ? (currentMessage as PredefinedMessage) : m));
        } else {
            setMessages([...messages, { ...currentMessage, id: Date.now().toString() } as PredefinedMessage]);
        }
        setIsFormOpen(false);
        setCurrentMessage({});
    }

    const handleDelete = (id: string) => {
        setMessages(messages.filter(m => m.id !== id));
    }

    return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>Mensajes Predefinidos</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold">Lista de Mensajes</h3>
                    <Button size="sm" variant="outline" onClick={() => { setCurrentMessage({}); setIsFormOpen(true); }}>
                        <PlusCircle className="h-4 w-4 mr-2" />
                        Nuevo
                    </Button>
                </div>
                <ScrollArea className="h-72">
                    <div className="space-y-2 pr-4">
                    {messages.map(msg => (
                        <div key={msg.id} className="p-2 border rounded-lg flex justify-between items-center">
                            <button className="text-left flex-1 hover:text-primary" onClick={() => onSelectMessage(msg.message)}>
                                <p className="font-medium">{msg.title}</p>
                            </button>
                            <div className="flex items-center">
                                <Button variant="ghost" size="icon" onClick={() => { setCurrentMessage(msg); setIsFormOpen(true); }}>
                                    <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(msg.id)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                    </div>
                </ScrollArea>
            </div>
            {isFormOpen && (
                <div>
                    <h3 className="font-semibold mb-4">{currentMessage.id ? 'Editar Mensaje' : 'Nuevo Mensaje'}</h3>
                    <div className="space-y-4">
                        <Input
                            placeholder="Título"
                            value={currentMessage.title || ''}
                            onChange={(e) => setCurrentMessage({ ...currentMessage, title: e.target.value })}
                        />
                        <Textarea
                            placeholder="Mensaje"
                            value={currentMessage.message || ''}
                            onChange={(e) => setCurrentMessage({ ...currentMessage, message: e.target.value })}
                            rows={5}
                        />
                    </div>
                     <DialogFooter className="mt-4">
                        <Button variant="ghost" onClick={() => setIsFormOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSave}>Guardar</Button>
                    </DialogFooter>
                </div>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PredefinedMessagesModal;
