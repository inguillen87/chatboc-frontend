// src/components/ui/AdjuntarArchivo.tsx
import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Paperclip, Image as ImageIcon } from 'lucide-react';
import { apiFetch } from '@/utils/api';
import { useUser } from '@/hooks/useUser';
import { toast } from '@/components/ui/use-toast';

const MAX_FILE_SIZE_MB = 10;
const ALL_ALLOWED_EXTENSIONS = [
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif', 'pdf', 'doc', 'docx',
  'xls', 'xlsx', 'csv', 'ppt', 'pptx', 'txt', 'md', 'rtf', 'mp3', 'wav',
  'ogg', 'aac', 'm4a', 'mp4', 'mov', 'webm', 'avi', 'mkv',
];
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif'];

export interface AdjuntarArchivoProps {
  onUpload?: (data: any) => void;
  asImage?: boolean;
}

const AdjuntarArchivo: React.FC<AdjuntarArchivoProps> = ({ onUpload, asImage = false }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useUser();

  const allowedExtensions = asImage ? IMAGE_EXTENSIONS : ALL_ALLOWED_EXTENSIONS;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!allowedExtensions.includes(ext)) {
      toast({
        title: "Archivo no permitido",
        description: `El formato de archivo ".${ext}" no está permitido.`,
        variant: "destructive",
        duration: 5000,
      });
      e.target.value = '';
      return;
    }

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast({
        title: "Archivo demasiado grande",
        description: `El archivo excede el tamaño máximo de ${MAX_FILE_SIZE_MB}MB.`,
        variant: "destructive",
        duration: 5000,
      });
      e.target.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('archivo', file);

    // Podríamos añadir un toast de "Subiendo..." aquí si la subida puede tardar
    // toast({ title: "Subiendo archivo...", description: file.name });

    try {
      const data = await apiFetch<any>('/archivos/subir', {
        method: 'POST',
        body: formData,
        // No es necesario 'Content-Type': 'multipart/form-data', FormData lo maneja.
      });
      
      // El toast de éxito se podría manejar en el componente padre (ChatInput)
      // o aquí si se considera genérico para cualquier uso de AdjuntarArchivo.
      // Por ahora, lo dejamos al componente padre como estaba.
      onUpload && onUpload(data);

    } catch (err: any) {
      const errorMessage = err.body?.error || err.message || 'Error desconocido al subir archivo.';
      toast({
        title: "Error al subir archivo",
        description: errorMessage,
        variant: "destructive",
        duration: 7000,
      });
    } finally {
      // Siempre resetear el input después del intento (éxito o fallo manejado por toast)
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  if (!user) {
    // console.log('AdjuntarArchivo: No user found, component will not render button.'); // Mantener para depuración
    // No renderizar nada si no hay usuario, o un placeholder/mensaje si se prefiere.
    return null; 
  }

  return (
    <div className="flex items-center"> {/* Eliminado gap-2, el toast no necesita estar espaciado aquí */}
      <Button
        onClick={() => {
          // console.log('AdjuntarArchivo: Paperclip button clicked'); // Mantener para depuración
          inputRef.current?.click();
        }}
        variant="outline"
        size="icon"
        type="button" // Importante para no enviar formularios accidentalmente
        aria-label="Adjuntar archivo"
        // Podríamos añadir un estado 'disabled' mientras sube, si es necesario.
      >
        <Paperclip className="w-4 h-4" />
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept={allowedExtensions.map((ext) => `.${ext}`).join(',')}
        className="hidden"
        onChange={handleFileChange}
      />
      {/* El span de error local se ha eliminado. Los errores se muestran mediante toasts. */}
    </div>
  );
};

export default AdjuntarArchivo;
