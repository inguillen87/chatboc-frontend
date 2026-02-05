# Tareas para el Backend (Backend Tasks)

Para garantizar que el Widget de Chat se inicialice correctamente y evite errores 403, necesitamos que el backend implemente o verifique lo siguiente:

## 1. Configuración del Widget (Critico)
**Endpoint:** `/api/public/tenants/:tenantSlug/widget-config`

Asegurar que este endpoint devuelva explícitamente el campo `tipo_chat` o `endpoint`.
*   Si es un municipio, debe devolver: `"tipo_chat": "municipio"` o `"endpoint": "municipio"`.
*   Esto permite al frontend saber *antes* de iniciar cualquier chat a qué endpoint pegar (`/ask/municipio` vs `/ask/pyme`).

## 2. Manejo de Errores de Endpoint (Robustez)
**Endpoint:** `/ask/pyme`

Si el frontend (por error de caché o race condition) llama a `/ask/pyme` con un `tenant_slug` que corresponde a un **Municipio**:
*   **NO** devolver un 403 genérico.
*   **DEVOLVER** un 409 Conflict (o 400 Bad Request) con un cuerpo JSON que indique el error específico.
*   Ejemplo de respuesta sugerida:
    ```json
    {
      "error": "endpoint_mismatch",
      "message": "Este tenant es un municipio. Use /ask/municipio",
      "expected_endpoint": "/ask/municipio",
      "actual_tipo_chat": "municipio"
    }
    ```
Esto ayudaría enormemente a diagnosticar problemas en el futuro.

## 3. Info del Tenant
**Endpoint:** `/api/pwa/tenant-info`

Verificar que la respuesta incluya `rubro_publico` (ej: "municipios") y/o `tipo_chat`. El frontend usa esto como fallback para determinar si debe mostrar el selector de rubros o forzar modo municipio.

## 4. Validación de Rubros
Asegurar que si un usuario intenta iniciar conversación en `/ask/pyme` sin un `rubro_clave`, el backend devuelva un error claro ("rubro_required") en lugar de intentar inferirlo incorrectamente si es ambiguo.
