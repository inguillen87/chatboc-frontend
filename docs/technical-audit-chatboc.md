# Informe de Auditoría Técnica – Plataforma Chatboc

Este documento resume los hallazgos de la auditoría técnica realizada al frontend y backend de la plataforma Chatboc. Incluye causas raíz, impacto, soluciones recomendadas, consideraciones multi-tenant y sugerencias de mejora para estabilizar y asegurar la plataforma.

## 1. Errores detectados en el Frontend

### 1.1 Errores de React (Error #300 minificado y manejo de ErrorBoundary)
- **Causa raíz:** Renderizado condicional que altera el orden de hooks (p. ej., `useState`/`useEffect`) provocando "Minified React error #300". Ausencia de Error Boundaries locales en módulos críticos.
- **Impacto:** Pantallas en blanco o paneles inaccesibles (Tickets, Encuestas) sin feedback para el usuario.
- **Solución recomendada:** Revisar componentes para evitar hooks condicionados, eliminar retornos prematuros y agregar Error Boundaries por módulo (además del global existente).

### 1.2 Problemas de CORS en peticiones fetch al backend
- **Causa raíz:** El widget solicitaba rutas sin contexto de tenant (ej. `/productos` en lugar de `/<tenant>/productos`) y el backend no siempre devolvía cabeceras CORS completas.
- **Impacto:** Bloqueo de peticiones (catálogo, carrito) con errores de red/CORS en el navegador.
- **Solución recomendada:** Incluir siempre el slug/ID del tenant en las URLs del widget y mantener la configuración CORS (cabeceras `Access-Control-Allow-Origin`, `Allow-Headers`, `Allow-Methods`) reflejando dominios y encabezados esperados.

### 1.3 Malas prácticas en el manejo de login y sesión en el widget
- **Causa raíz:** Uso exclusivo de `localStorage` para tokens, ausencia de sincronización con el panel principal y mezcla de identificadores anónimos con JWT sin patrón consistente.
- **Impacto:** Riesgos de seguridad (exposición a XSS), doble inicio de sesión, pérdida de sesión al refrescar y experiencia inconsistente.
- **Solución recomendada:** Centralizar autenticación (idealmente con cookies seguras o SSO), usar el contexto `useUser` para refrescar estado tras login, unificar logout/login y documentar claramente los tokens (`authToken`, `chatAuthToken`).

### 1.4 Fallos de UX en el flujo del carrito y navegación con usuarios logueados
- **Causa raíz:** Checkout para anónimos incompleto, falta de redirección al login cuando se requieren credenciales y ausencia de feedback en intentos de canje/donación.
- **Impacto:** Canjes fallidos sin explicación, pedidos incompletos y confusión tras iniciar sesión (UI sigue mostrando estado anónimo).
- **Solución recomendada:** Exigir login antes de acciones sensibles (canje de puntos), pedir datos de contacto para compras anónimas, actualizar inmediatamente la UI tras login y preservar el carrito al autenticar.

### 1.5 Problemas de validación de usuario y persistencia de sesión
- **Causa raíz:** Registro sin verificación de email/SMS, sin refresh tokens ni avisos de expiración y almacenamiento de usuario en `localStorage` que puede quedar desactualizado.
- **Impacto:** Riesgos de spam/suplantación, cierres de sesión inesperados y estado de usuario inconsistente.
- **Solución recomendada:** Implementar verificación de correo/teléfono, incorporar refresh tokens o renovaciones silenciosas, invocar `refreshUser` tras operaciones clave y notificar expiración de sesión.

## 2. Errores detectados en el Backend

### 2.1 API devolviendo 400 (Bad Request) por falta de tenantId
- **Causa raíz:** Endpoints que requieren slug/ID de tenant sin fallback; `_resolve_tenant` aborta si falta el parámetro.
- **Impacto:** Respuestas 400/404 en catálogo/carrito público, bloqueando funcionalidades.
- **Solución recomendada:** Enviar siempre el tenant desde el frontend, mejorar mensajes de error y reforzar middleware centralizado de resolución de tenant.

### 2.2 Rutas `/productos`, `/carrito`, `/assign`, `/asignar` respondiendo con 400, 405 o 500
- **Causa raíz:** Uso de rutas sin contexto de tenant, colisión entre rutas públicas/admin y duplicidad de endpoints de asignación con métodos inconsistentes.
- **Impacto:** Listados de productos/carritos fallidos y reasignaciones de tickets que no se ejecutan o generan 500.
- **Solución recomendada:** Normalizar URLs por contexto (público vs admin), exigir tenant en catálogo/carrito, consolidar una sola ruta/método para asignar tickets y manejar errores con códigos descriptivos.

### 2.3 Inconsistencia en definición y asignación de usuarios vs. agentes
- **Causa raíz:** Un único modelo `User` para ciudadanos y empleados sin proceso formal de promoción/democión ni permisos diferenciados.
- **Impacto:** Dificultad para gestionar roles, tickets huérfanos al eliminar agentes y riesgo de permisos excesivos o insuficientes.
- **Solución recomendada:** Definir roles/permisos claros (admin, empleado, usuario, super_admin), vincular empleados a su tenant/categorías, permitir cambio de rol desde el panel y reasignar tickets al eliminar empleados.

### 2.4 Uso inadecuado del método HTTP
- **Causa raíz:** Desalineación entre frontend y backend respecto a métodos permitidos (POST vs PUT/GET/DELETE), causando 405.
- **Impacto:** Acciones que no se ejecutan (carrito, asignación de tickets) y depuración costosa.
- **Solución recomendada:** Documentar métodos esperados, ajustar clientes, reducir duplicidad de verbos y devolver mensajes JSON en 405 para facilitar diagnóstico.

## 3. Arquitectura multi-tenant

### 3.1 Falta de aislamiento por tenant
- **Causa raíz:** Migración incompleta a multi-tenant; consultas sin filtrar por `tenant_id` y rutas públicas sin validación de `g.tenant_profile`.
- **Impacto:** Riesgo de filtración de datos entre tenants y mezclas de catálogos/carritos.
- **Solución recomendada:** Asegurar campos `tenant_id` en todas las entidades, aplicar filtros automáticos en consultas, exigir tenant en rutas públicas y probar con múltiples tenants.

### 3.2 Usuarios empleados sin gestión de permisos ni scope limitado
- **Causa raíz:** Rol `empleado` sin sub-roles ni asignación a categorías/departamentos; todos los empleados comparten el mismo alcance.
- **Impacto:** Sobrecarga operativa, mayores riesgos internos y falta de flexibilidad organizacional.
- **Solución recomendada:** Introducir sub-roles (ej. coordinador/agente), permitir asociación a categorías/equipos, crear UI de administración de permisos y reforzar checks de rol en endpoints sensibles.

### 3.3 Mezcla de lógica de usuarios finales y de agentes/admins
- **Causa raíz:** Endpoints y flujos compartidos (ej. `/auth/login` único) sin separación clara de contextos ciudadano vs. interno.
- **Impacto:** Complejidad y posibles brechas si un rol accede a APIs no previstas; UX inconsistente entre panel y widget.
- **Solución recomendada:** Separar blueprints/URLs para público y administración, aplicar políticas de seguridad diferenciadas, mantener interfaces distintas y probar cruces de contexto.

## 4. Seguridad y errores estructurales

### 4.1 Faltan cabeceras de CORS configuradas
- **Causa raíz:** Configuración incompleta de `flask_cors` (orígenes y cabeceras personalizadas como `X-Tenant`, `X-Widget-Token`, `Anon-Id`).
- **Impacto:** Bloqueo de peticiones del widget por políticas del navegador.
- **Solución recomendada:** Definir orígenes permitidos, habilitar credenciales cuando aplique y listar todos los headers/métodos requeridos en las respuestas y preflights.

### 4.2 No se valida adecuadamente el `auth_token` en todas las rutas
- **Causa raíz:** Endpoints sensibles sin `@token_requerido` o con validaciones incompletas (escenarios anónimos mal controlados).
- **Impacto:** Accesos no autorizados o pedidos sin dueño; mayor superficie de ataque.
- **Solución recomendada:** Revisar todos los endpoints, aplicar decoradores de autenticación/rol según corresponda, reforzar validación de `anon_id`/tokens y devolver 401/403 claros.

### 4.3 El login del widget falla sin feedback detallado
- **Causa raíz:** Manejo incompleto de errores en el formulario del widget; mensajes genéricos o ausentes ante credenciales inválidas/CORS/caídas de auth.
- **Impacto:** Usuarios sin claridad sobre por qué no pueden iniciar sesión; aumento de frustración y soporte.
- **Solución recomendada:** Capturar y categorizar errores (401 vs. fallas de servicio), mostrar mensajes visibles en el widget y alinear textos con el login del sitio principal.

## 5. Sugerencias de mejora
- Implementar sistema robusto de roles/permisos, incluyendo sub-roles y vínculos obligatorios a tenant/categorías.
- Normalizar rutas backend con validación de tenant y métodos HTTP correctos; documentar y eliminar duplicados.
- Modularizar frontend y ampliar Error Boundaries para reducir errores React y aislar fallas por módulo.
- Asegurar persistencia coherente del login (refresh tokens, avisos de expiración) y reflejo inmediato de la UI autenticada.
- Optimizar flujos del widget (login/redirección/carrito/encuestas) preservando contexto y solicitando datos necesarios en cada paso.

Estas acciones priorizan estabilidad, seguridad y escalabilidad en el contexto multi-tenant de Chatboc.
