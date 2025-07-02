// src/utils/files.ts
export const formatFileSize = (bytes?: number): string => {
  if (bytes === undefined || bytes === null || isNaN(bytes)) return '';
  if (bytes === 0) return '(0 KB)';

  const k = 1024;
  
  if (bytes < k) {
    return `(${bytes} Bytes)`;
  }
  
  if (bytes < 104857.6) { // Menos de 0.1 MB (pero >= 1KB), mostrar en KB
    return `(${(bytes / k).toFixed(1)} KB)`;
  } else { // 0.1 MB o más, mostrar en MB
    return `(${(bytes / (k * k)).toFixed(1)} MB)`;
  }
};