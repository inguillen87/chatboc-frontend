// src/components/ui/AdjuntarArchivo.tsx
import React, { useRef, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { Paperclip } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const MAX_FILE_SIZE_MB = 10;
const ALL_ALLOWED_MIMETYPES = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/gif': ['gif'],
  'image/webp': ['webp'],
  'image/svg+xml': ['svg'],
  'image/avif': ['avif'],
  'application/pdf': ['pdf'],
  'application/msword': ['doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  'application/vnd.ms-excel': ['xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
  'text/csv': ['csv'],
  'application/vnd.ms-powerpoint': ['ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['pptx'],
  'text/plain': ['txt', 'md'],
  'application/rtf': ['rtf'],
  'audio/mpeg': ['mp3'],
  'audio/wav': ['wav'],
  'audio/ogg': ['ogg'],
  'audio/aac': ['aac'],
  'audio/x-m4a': ['m4a'],
  'video/mp4': ['mp4'],
  'video/quicktime': ['mov'],
  'video/webm': ['webm'],
  'video/x-matroska': ['mkv'],
  'video/x-msvideo': ['avi'],
};

export interface AdjuntarArchivoProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
  allowedFileTypes?: string[]; // e.g., ['image/*', 'application/pdf']
}

export interface AdjuntarArchivoHandle {
  openFileDialog: () => void;
}

const AdjuntarArchivo = forwardRef<AdjuntarArchivoHandle, AdjuntarArchivoProps>(({ onFileSelected, disabled = false, allowedFileTypes }, ref) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    openFileDialog: () => {
      inputRef.current?.click();
    },
  }));

  const getMimeTypes = () => {
    if (!allowedFileTypes) return Object.keys(ALL_ALLOWED_MIMETYPES);
    let mimes: string[] = [];
    allowedFileTypes.forEach(type => {
      if (type.endsWith('/*')) {
        const prefix = type.slice(0, -1);
        mimes.push(...Object.keys(ALL_ALLOWED_MIMETYPES).filter(m => m.startsWith(prefix)));
      } else {
        mimes.push(type);
      }
    });
    return mimes;
  };

  const allowedMimeTypes = getMimeTypes();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileMime = file.type;

    if (!allowedMimeTypes.includes(fileMime)) {
      toast({
        title: "Archivo no permitido",
        description: `El tipo de archivo "${fileMime}" no está permitido.`,
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

    onFileSelected(file);

    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

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
        disabled={disabled}
      >
        <Paperclip className="w-4 h-4" />
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept={allowedFileTypes ? allowedFileTypes.join(',') : '*/*'}
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled}
        capture={allowedFileTypes?.some(type => type.startsWith('image/')) ? 'environment' : undefined}
      />
      {/* El span de error local se ha eliminado. Los errores se muestran mediante toasts. */}
    </div>
  );
});

AdjuntarArchivo.displayName = 'AdjuntarArchivo';

export default AdjuntarArchivo;
