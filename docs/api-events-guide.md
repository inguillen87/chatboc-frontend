# Guía de API: Gestor de Eventos y Noticias

Este documento describe cómo utilizar el endpoint del backend para crear nuevos eventos o noticias para un municipio o pyme.

## Resumen del Endpoint

| Característica | Valor |
| --- | --- |
| **URL** | `/api/municipio/events` |
| **Método HTTP** | `POST` |
| **Autenticación** | Requerida (Bearer Token JWT) |
| **Permisos** | Rol `admin` o `empleado` |

---

## Autenticación

Todas las peticiones a este endpoint deben incluir un encabezado `Authorization` con el token JWT del usuario autenticado. El frontend ya gestiona esto a través de la utilidad `apiFetch`.

**Ejemplo de Encabezado:**
```
Authorization: Bearer <el_token_jwt_del_usuario>
```

---

## Cuerpo de la Petición (Request Body)

La petición debe enviar un objeto JSON con los detalles del evento.

**Estructura del Objeto:**
```json
{
  "title": "string (Requerido)",
  "description": "string",
  "startDate": "string (Requerido, formato ISO 8601, ej: '2025-10-26T10:00:00Z')",
  "endDate": "string (Opcional, formato ISO 8601)",
  "location": {
    "address": "string",
    "lat": "number (opcional)",
    "lng": "number (opcional)"
  },
  "category": "string (ej: 'Cultura', 'Deportes', 'Comunidad')",
  "imageUrl": "string (URL a una imagen, opcional)",
  "organizer": "string (Nombre del organizador, opcional)"
}
```

**Ejemplo de cuerpo de la petición:**
```json
{
  "title": "Feria del Libro 2025",
  "description": "La feria anual del libro con autores invitados y descuentos especiales.",
  "startDate": "2025-08-15T09:00:00Z",
  "location": {
    "address": "Plaza Principal, Villa Genovesa"
  },
  "category": "Cultura",
  "imageUrl": "https://ejemplo.com/feria_del_libro.jpg"
}
```

---

## Respuestas del Servidor

### Respuesta Exitosa (`201 Created`)

Si el evento se crea correctamente, el servidor responderá con un código `201 Created` y el objeto completo del evento recién creado, incluyendo los campos generados por el servidor (`id`, `createdAt`, `updatedAt`, `status`).

**Ejemplo de respuesta:**
```json
{
  "id": "2025-08-21T12:30:00.123Z12345",
  "title": "Feria del Libro 2025",
  "description": "La feria anual del libro con autores invitados y descuentos especiales.",
  "startDate": "2025-08-15T09:00:00Z",
  "location": {
    "address": "Plaza Principal, Villa Genovesa"
  },
  "category": "Cultura",
  "imageUrl": "https://ejemplo.com/feria_del_libro.jpg",
  "organizer": null,
  "status": "published",
  "createdAt": "2025-08-21T12:30:00.123Z",
  "updatedAt": "2025-08-21T12:30:00.123Z"
}
```

### Respuestas de Error

-   **`400 Bad Request`**: La petición no es válida (ej. faltan campos requeridos como `title` o `startDate`).
    ```json
    { "error": "Bad Request. Missing required event fields." }
    ```
-   **`401 Unauthorized`**: El token de autenticación no es válido o no fue provisto.
    ```json
    { "error": "Authentication failed. Invalid or missing token." }
    ```
-   **`403 Forbidden`**: El usuario está autenticado pero no tiene el rol de `admin` o `empleado`.
    ```json
    { "error": "Forbidden. User does not have sufficient privileges." }
    ```
-   **`500 Internal Server Error`**: Ocurrió un error inesperado en el servidor.
    ```json
    { "error": "Internal Server Error" }
    ```

---

## Ejemplo de Implementación en Frontend

Para usar este endpoint, se recomienda utilizar la función `apiFetch` que ya existe en el proyecto, ya que maneja automáticamente la autenticación y el formato de la URL.

```typescript
import { apiFetch, getErrorMessage } from '@/utils/api';

async function createNewEvent(eventData) {
  try {
    const newEvent = await apiFetch('/api/municipio/events', {
      method: 'POST',
      body: eventData,
    });
    console.log('Evento creado con éxito:', newEvent);
    // Lógica para actualizar la UI, mostrar un toast, etc.
    return newEvent;
  } catch (error) {
    console.error('Error al crear el evento:', error);
    const friendlyMessage = getErrorMessage(error);
    // Mostrar `friendlyMessage` al usuario.
  }
}

// Ejemplo de uso
const eventData = {
  title: "Concierto de Rock",
  startDate: "2025-09-20T21:00:00Z",
  description: "Bandas locales en vivo.",
  category: "Música"
};

createNewEvent(eventData);
```
