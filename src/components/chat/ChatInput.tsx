// src/components/chat/ChatInput.tsx
import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { Send, MapPin, Mic, MicOff, X, FileText } from "lucide-react";
import AdjuntarArchivo, { AdjuntarArchivoHandle } from "@/components/ui/AdjuntarArchivo";
import { apiFetch, getErrorMessage } from "@/utils/api";
import { requestLocation } from "@/utils/geolocation";
import { toast } from "@/components/ui/use-toast";
import useAudioRecorder from "@/hooks/useAudioRecorder";
import { AttachmentInfo } from "@/utils/attachment";
import { SendPayload } from "@/types/chat";
import { Button } from "@/components/ui/button";

export interface ChatInputHandle {
  openFilePicker: () => void;
}

interface Props {
  onSendMessage: (payload: SendPayload) => void;
  isTyping: boolean;
  inputRef?: React.RefObject<HTMLInputElement>;
  onTypingChange?: (typing: boolean) => void;
  onSystemMessage?: (text: string, type: 'error' | 'info') => void;
}

const PLACEHOLDERS = [
  "Escribí tu mensaje...",
  "¿En qué puedo ayudarte hoy?",
  "Probá: '¿Qué hace Chatboc?'",
  "¿Cuánto cuesta el servicio?",
];

const ChatInput = forwardRef<ChatInputHandle, Props>(({ onSendMessage, isTyping, inputRef, onTypingChange, onSystemMessage }, ref) => {
  const [input, setInput] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isLocating, setIsLocating] = useState(false);
  const [attachmentPreview, setAttachmentPreview] = useState<{ file: File; previewUrl: string } | null>(null);
  const internalRef = inputRef || useRef<HTMLInputElement>(null);
  const { isRecording, startRecording, stopRecording } = useAudioRecorder();
  const adjRef = useRef<AdjuntarArchivoHandle>(null);

  useImperativeHandle(ref, () => ({
    openFilePicker: () => {
      adjRef.current?.openFileDialog();
    },
  }));

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % PLACEHOLDERS.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const handleSend = async () => {
    if ((!input.trim() && !attachmentPreview) || isTyping) return;

    let attachmentData: AttachmentInfo | undefined = undefined;

    if (attachmentPreview) {
      toast({ title: "Subiendo archivo...", description: attachmentPreview.file.name });
      const formData = new FormData();
      formData.append('file', attachmentPreview.file);

      try {
        const response = await apiFetch<{ url: string; thumbUrl: string; name: string; mimeType: string; size: number }>('/archivos/upload/chat_attachment', {
          method: 'POST',
          body: formData,
        });
        attachmentData = {
          url: response.url,
          thumbUrl: response.thumbUrl,
          name: response.name,
          mimeType: response.mimeType,
          size: response.size,
        };
      } catch (error) {
        console.error("Error uploading file:", error);
        toast({ title: "Error de subida", description: "No se pudo subir el archivo.", variant: "destructive" });
        setAttachmentPreview(null); // Clear preview on error
        return;
      }
    }

    onSendMessage({ text: input.trim(), attachmentInfo: attachmentData });
    setInput("");
    setAttachmentPreview(null);
    onTypingChange?.(false);
    internalRef.current?.focus();
  };

  const handleFileSelected = (file: File) => {
    const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : "";
    setAttachmentPreview({ file, previewUrl });
    // Revoke the object URL when the component unmounts or the preview changes
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  };

  const handleShareLocation = async () => {
    if (isTyping || isLocating) return;
    setIsLocating(true);
    toast({ title: "Obteniendo ubicación...", description: "Por favor, acepta la solicitud de GPS.", duration: 2000 });
    try {
      const coords = await requestLocation({ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
      if (coords) {
        onSendMessage({
          text: "", // Texto vacío como pide el backend
          location: { lat: coords.latitud, lon: coords.longitud } // Usar el nuevo formato
        });
        toast({ title: "Ubicación enviada", description: "Tu ubicación ha sido compartida.", duration: 3000 });
      } else {
        toast({ title: "Ubicación no disponible", description: "No pudimos acceder a tu ubicación por GPS. Verificá los permisos y que estés usando una conexión segura (https).", variant: "destructive", duration: 5000 });
      }
    } catch (error) {
      console.error("Error al obtener ubicación:", error);
      toast({ title: "Error al obtener ubicación", description: "Hubo un problema al intentar obtener tu ubicación.", variant: "destructive", duration: 5000 });
    } finally {
      setIsLocating(false);
    }
    setInput("");
    onTypingChange?.(false);
  };

  const handleSendAudio = async (audioBlob: Blob) => {
    if (isTyping) return;
    onSystemMessage?.('Enviando audio...', 'info');

    const formData = new FormData();
    const filename = `audio-grabado-${Date.now()}.webm`;
    formData.append('file', audioBlob, filename);

    try {
      const data = await apiFetch<any>('/archivos/upload/chat_attachment', {
        method: 'POST',
        body: formData,
      });

      if (!data || !data.url || !data.name) {
        throw new Error("La respuesta del servidor para la subida del audio fue inválida.");
      }

      onSendMessage({
        text: `Audio adjunto: ${data.name}`,
        attachmentInfo: {
          name: data.name,
          url: data.url,
          mimeType: 'audio/webm',
        }
      });
      // Optional: a success system message could be sent here, but it might be noisy.
      // onSystemMessage?.('Audio enviado con éxito.', 'info');
    } catch (error) {
      console.error("Error al enviar audio:", error);
      const friendlyError = getErrorMessage(error, "Hubo un problema al subir tu grabación.");
      onSystemMessage?.(friendlyError, 'error');
    }
  };

  return (
    <div className="w-full flex flex-col gap-2 px-2 py-2 sm:px-3 sm:py-3 bg-background">
      {attachmentPreview && (
        <div className="relative w-full p-2 bg-muted rounded-lg flex items-center gap-3">
          {attachmentPreview.previewUrl ? (
            <img src={attachmentPreview.previewUrl} alt="Preview" className="w-14 h-14 rounded-md object-cover" />
          ) : (
            <div className="w-14 h-14 flex-shrink-0 flex items-center justify-center bg-secondary rounded-md">
              <FileText className="w-7 h-7 text-secondary-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{attachmentPreview.file.name}</p>
            <p className="text-xs text-muted-foreground">{(attachmentPreview.file.size / 1024).toFixed(1)} KB</p>
          </div>
          <Button variant="ghost" size="icon" className="absolute top-1 right-1 w-6 h-6" onClick={() => setAttachmentPreview(null)}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}
      <div className="w-full flex items-center gap-1 sm:gap-2">
        <AdjuntarArchivo
          ref={adjRef}
          onFileSelected={handleFileSelected}
          disabled={isRecording || !!attachmentPreview}
          allowedFileTypes={['image/*', 'application/pdf']}
        />
        <button
          onClick={handleShareLocation}
          disabled={isTyping || isLocating || isRecording || !!attachmentPreview}
          className={`
            flex items-center justify-center
            rounded-full p-2 sm:p-2.5
            shadow-md transition-all duration-150
            focus:outline-none focus:ring-2 focus:ring-primary/60 focus:ring-offset-1 focus:ring-offset-background
            active:scale-95
            bg-secondary text-secondary-foreground hover:bg-secondary/80
            ${isTyping || isLocating || !!attachmentPreview ? "opacity-50 cursor-not-allowed" : ""}
          `}
          aria-label="Compartir ubicación"
          type="button"
        >
          {isLocating ? <div className="w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin" /> : <MapPin className="w-5 h-5" />}
        </button>
        <button
          onClick={async () => {
            if (isRecording) {
              const audioBlob = await stopRecording();
              if (audioBlob) {
                handleSendAudio(audioBlob);
              }
            } else {
              try {
                await startRecording();
              } catch (error) {
                toast({ title: "Error al grabar", description: "No se pudo iniciar la grabación. Verifica los permisos del micrófono.", variant: "destructive" });
              }
            }
          }}
          disabled={isTyping || isLocating || !!attachmentPreview}
          className={`
            flex items-center justify-center
            rounded-full p-2 sm:p-2.5
            shadow-md transition-all duration-150
            focus:outline-none focus:ring-2 focus:ring-primary/60 focus:ring-offset-1 focus:ring-offset-background
            active:scale-95
            bg-secondary text-secondary-foreground hover:bg-secondary/80
            ${isTyping || isLocating || !!attachmentPreview ? "opacity-50 cursor-not-allowed" : ""}
            ${isRecording ? "text-destructive bg-destructive/20 hover:bg-destructive/30" : ""}
          `}
          aria-label={isRecording ? "Detener grabación" : "Grabar audio"}
          type="button"
        >
          {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>
        <input
          ref={internalRef}
          className={`
            flex-1 max-w-full min-w-0
            rounded-full px-4 py-2 sm:px-4 sm:py-2.5
            text-base
            outline-none transition-all duration-200
            focus:ring-2 focus:ring-primary/50 focus:border-transparent
            placeholder:text-muted-foreground
            font-medium
            disabled:cursor-not-allowed
            bg-input text-foreground
            border border-border
            dark:bg-input dark:text-foreground dark:border-border
            ${isTyping ? "opacity-60 bg-muted-foreground/10 dark:bg-muted-foreground/20" : ""}
          `}
          type="text"
          placeholder={attachmentPreview ? "Añade un comentario..." : PLACEHOLDERS[placeholderIndex]}
          value={input}
          onChange={(e) => {
            const val = e.target.value;
            setInput(val);
            onTypingChange?.(val.trim().length > 0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          autoFocus
          autoComplete="off"
          maxLength={200}
          aria-label="Escribir mensaje"
          disabled={isTyping || isRecording}
        />
        <button
          className={`
            flex items-center justify-center
            rounded-full p-2.5 sm:p-3 ml-1 sm:ml-2
            shadow-md transition-all duration-150
            focus:outline-none focus:ring-2 focus:ring-primary/60 focus:ring-offset-1 focus:ring-offset-background
            active:scale-95
            bg-primary text-primary-foreground hover:bg-primary/90
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
          onClick={handleSend}
          disabled={(!input.trim() && !attachmentPreview) || isTyping || isRecording}
          aria-label="Enviar mensaje"
          type="button"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
});

ChatInput.displayName = 'ChatInput';

export default ChatInput;