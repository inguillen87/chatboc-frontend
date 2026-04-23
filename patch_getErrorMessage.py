import re

with open('src/utils/api.ts', 'r') as f:
    content = f.read()

# Replace getErrorMessage with one that uses error.requestId and error.body for more detail
new_getErrorMessage = """
export function getErrorMessage(error: unknown, fallback = "Ocurrió un error inesperado.") {
  if (error instanceof ApiError) {
    const requestIdMsg = error.requestId ? ` (Req ID: ${error.requestId})` : "";
    let baseMessage = error.message;

    if (!baseMessage || baseMessage === "Error en la respuesta de la API") {
      switch (error.status) {
        case 400:
          baseMessage = "Hubo un problema con la solicitud. Por favor, verifica los datos enviados.";
          break;
        case 401:
          baseMessage = "No estás autorizado para realizar esta acción. Por favor, inicia sesión de nuevo.";
          break;
        case 403:
          baseMessage = "No tienes permiso para acceder a este recurso.";
          break;
        case 404:
          baseMessage = "No se pudo encontrar el recurso solicitado (Error 404).";
          break;
        case 500:
          baseMessage = "Ocurrió un error en el servidor. Por favor, intenta de nuevo más tarde.";
          break;
        default:
          baseMessage = `Ocurrió un error (código: ${error.status})`;
      }
    }

    // If we have validation errors from zod, we might append them
    if (error.body && typeof error.body === 'object' && '_errors' in error.body) {
       baseMessage += ` [Validación fallida]`;
    }

    return `${baseMessage}${requestIdMsg}`;
  }

  if (error instanceof NetworkError) {
    return error.message;
  }

  if (error && typeof (error as any).message === "string") {
    // Para errores que no son de la API pero tienen un mensaje (ej. errores de red)
    return (error as any).message;
  }
  return fallback;
}
"""

content = re.sub(
    r'export function getErrorMessage\([^}]+\n(\s+.*\n)+?\}',
    new_getErrorMessage.strip(),
    content
)

with open('src/utils/api.ts', 'w') as f:
    f.write(content)
