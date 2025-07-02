import React, { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Paperclip } from 'lucide-react'
import { apiFetch } from '@/utils/api'
import { useUser } from '@/hooks/useUser'

const MAX_FILE_SIZE_MB = 10
const ALLOWED_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'pdf',
  'xlsx',
  'xls',
  'csv',
  'docx',
  'txt',
]

export interface AdjuntarArchivoProps {
  onUpload?: (data: any) => void // 'data' es el objeto que viene del backend, esperamos que contenga 'url'
}

const AdjuntarArchivo: React.FC<AdjuntarArchivoProps> = ({ onUpload }) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const { user } = useUser()

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0]
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setError('Formato no permitido')
      return
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError('Archivo demasiado grande (máx 10MB)')
      return
    }
    setError('')
    const formData = new FormData()
    formData.append('archivo', file)
    try {
      // Llamada al backend para subir el archivo
      const data = await apiFetch<any>('/archivos/subir', {
        method: 'POST',
        body: formData,
      })
      // Si la subida es exitosa, llama a onUpload con la 'data' completa (que incluye la URL)
      onUpload && onUpload(data) 
    } catch (err: any) {
      setError(err.body?.error || err.message || 'Error al subir archivo')
    }
  }

  if (!user) return null

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={() => inputRef.current?.click()}
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
      {error && <span className="text-destructive text-sm">{error}</span>}
    </div>
  )
}

export default AdjuntarArchivo