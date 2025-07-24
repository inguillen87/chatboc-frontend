import React, { useState, useEffect } from 'react';
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
import { PlusCircle, Edit, Trash2, Loader2 } from 'lucide-react';
import {
    getPredefinedMessages,
    createPredefinedMessage,
    updatePredefinedMessage,
    deletePredefinedMessage,
    PredefinedMessage,
} from '@/services/predefinedMessagesService';
import { toast } from 'sonner';

interface PredefinedMessagesModalProps {
  onSelectMessage: (message: string) => void;
  children: React.ReactNode;
}

const PredefinedMessagesModal: React.FC<PredefinedMessagesModalProps> = ({ onSelectMessage, children }) => {
    const [messages, setMessages] = useState<PredefinedMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [currentMessage, setCurrentMessage] = useState<Partial<PredefinedMessage>>({});

    const fetchMessages = async () => {
        setIsLoading(true);
        try {
            const fetchedMessages = await getPredefinedMessages();
            setMessages(fetchedMessages);
        } catch (error) {
            toast.error("No se pudieron cargar los mensajes predefinidos.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchMessages();
    }, []);

    const handleSave = async () => {
        setIsLoading(true);
        try {
            if (currentMessage.id) {
                await updatePredefinedMessage(currentMessage.id, { title: currentMessage.title, message: currentMessage.message });
                toast.success("Mensaje actualizado correctamente.");
            } else {
                await createPredefinedMessage({ title: currentMessage.title || '', message: currentMessage.message || '' });
                toast.success("Mensaje creado correctamente.");
            }
            await fetchMessages(); // Re-fetch all messages
            setIsFormOpen(false);
            setCurrentMessage({});
        } catch (error) {
            toast.error("No se pudo guardar el mensaje.");
        } finally {
            setIsLoading(false);
        }
    }

    const handleDelete = async (id: string) => {
        setIsLoading(true);
        try {
            await deletePredefinedMessage(id);
            toast.success("Mensaje eliminado correctamente.");
            await fetchMessages(); // Re-fetch all messages
        } catch (error) {
            toast.error("No se pudo eliminar el mensaje.");
        } finally {
            setIsLoading(false);
        }
    }

    return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>Mensajes Predefinidos</DialogTitle>
        </DialogHeader>
        {isLoading && <Loader2 className="animate-spin" />}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                {/* ... (código de la lista de mensajes con botones) ... */}
            </div>
            {isFormOpen && (
                <div>
                    {/* ... (código del formulario) ... */}
                </div>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PredefinedMessagesModal;
