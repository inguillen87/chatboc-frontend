// src/components/ui/AdjuntarArchivo.tsx
import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Paperclip } from 'lucide-react';
import { apiFetch } from '@/utils/api';
import { useUser } from '@/hooks/useUser';

const MAX_FILE_SIZE_MB = 10;
const ALLOWED_EXTENSIONS = [
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif',
  'pdf',
  'doc', 'docx',
  'xls', 'xlsx', 'csv',
  'ppt', 'pptx',
  'txt', 'md', 'rtf',
  'mp3', 'wav', 'ogg', 'aac', 'm4a',
  'mp4', 'mov', 'webm', 'avi', 'mkv',
];

export interface AdjuntarArchivoProps {
  onUpload?: (data: any) => void;
}

const AdjuntarArchivo: React.FC<AdjuntarArchivoProps> = ({ onUpload }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const { user } = useUser();

  console.log('AdjuntarArchivo: Component rendered. User object:', user);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('AdjuntarArchivo: handleFileChange triggered');
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setError(`Formato .${ext} no permitido.`);
      e.target.value = '';
      return;
    }

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`Archivo demasiado grande (máx ${MAX_FILE_SIZE_MB}MB).`);
      e.target.value = '';
      return;
    }

    setError('');

    const formData = new FormData();
    formData.append('archivo', file);

    try {
      const data = await apiFetch<any>('/archivos/subir', {
        method: 'POST',
        body: formData,
      });
      onUpload && onUpload(data);
    } catch (err: any) {
      setError(err.body?.error || err.message || 'Error al subir archivo');
    } finally {
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  if (!user) {
    console.log('AdjuntarArchivo: No user found, component will not render button.');
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={() => {
          console.log('AdjuntarArchivo: Paperclip button clicked');
          inputRef.current?.click();
        }}
        variant="outline"
        size="icon"
        type="button"
        aria-label="Adjuntar archivo"
      >
        <Paperclip className="w-4 h-4" />
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(',')}
        className="hidden"
        onChange={handleFileChange}
      />
      {error && <span className="text-destructive text-sm ml-2">{error}</span>}
    </div>
  );
};

export default AdjuntarArchivo;
