import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, ImageIcon, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface ImageUploadDropzoneProps {
  onImageAccepted: (file: File) => void;
  isLoading?: boolean;
}

export const ImageUploadDropzone: React.FC<ImageUploadDropzoneProps> = ({ onImageAccepted, isLoading }) => {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onImageAccepted(acceptedFiles[0]);
    }
  }, [onImageAccepted]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp'] },
    maxFiles: 1,
    disabled: isLoading
  });

  return (
    <div
      {...getRootProps()}
      className={`relative w-full p-6 border-2 border-dashed rounded-lg transition-colors cursor-pointer flex flex-col items-center justify-center gap-3 min-h-[160px]
        ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'}
        ${isLoading ? 'opacity-60 cursor-not-allowed' : ''}
      `}
    >
      <input {...getInputProps()} />
      {isLoading ? (
         <>
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm font-medium text-muted-foreground">Pre-analizando imagen...</p>
         </>
      ) : (
         <>
            <div className="p-3 bg-background rounded-full shadow-sm border">
               {isDragActive ? <UploadCloud className="w-6 h-6 text-primary" /> : <ImageIcon className="w-6 h-6 text-muted-foreground" />}
            </div>
            <div className="text-center">
               <p className="text-sm font-medium">Arrastra una imagen o haz clic aquí</p>
               <p className="text-xs text-muted-foreground mt-1">Soporta JPG, PNG, WEBP hasta 10MB</p>
            </div>
         </>
      )}
    </div>
  );
};
