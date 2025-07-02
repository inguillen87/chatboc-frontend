export const formatFileSize = (bytes?: number): string => {
  if (bytes === undefined || bytes === null || isNaN(bytes)) return '';
  if (bytes === 0) return '(0 KB)';

  const k = 1024;
  const units = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  if (bytes < k) {
    // Para menos de 1 KB, podemos mostrar en Bytes o en formato 0.x KB
    // Por consistencia con el formato previo que usaba KB como mínimo, haremos:
    // return `(${(bytes / k).toFixed(1)} KB)`; // Esto mostraría (0.5 KB) por ejemplo
    // O, si preferimos mostrar Bytes directamente para valores pequeños:
    return `(${bytes} Bytes)`; // Optaremos por esto para mayor precisión en pequeños archivos
                               // o podemos decidir un umbral, ej. si < 1KB, mostrar en Bytes, else en KB/MB etc.
                               // El formato anterior hacía (size/1024).toFixed(1) + ' KB' para size < 1MB
                               // Vamos a replicar el espíritu del formato anterior:
  }

  // Replicando el formato anterior: KB para < 0.1 MB, sino MB.
  // 0.1 MB = 0.1 * 1024 * 1024 bytes = 104857.6 bytes
  // 1 KB = 1024 bytes

  if (bytes < 104857.6) { // Menos de 0.1 MB, mostrar en KB
    return `(${(bytes / k).toFixed(1)} KB)`;
  } else { // Mostrar en MB
    return `(${(bytes / (k * k)).toFixed(1)} MB)`;
  }
  // Para una solución más genérica con múltiples unidades:
  // const i = Math.floor(Math.log(bytes) / Math.log(k));
  // const sizeInUnit = parseFloat((bytes / Math.pow(k, i)).toFixed(1));
  // return `(${sizeInUnit} ${units[i]})`;
};
