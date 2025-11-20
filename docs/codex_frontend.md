# Codex Frontend: Mejoras planificadas

Este documento reúne las líneas maestras para la evolución del frontend multi-tenant de Chatboc. Todas las experiencias deben seguir siendo white label y controladas por datos provistos por el backend.

## 1. Experiencia personalizada por tenant
- **Detección del tenant**: el widget o PWA obtiene el identificador desde el snippet, el dominio/subdominio o parámetros de URL y consulta un endpoint público (ej. `/api/pwa/public/tenant_info`) para construir `TenantPublicInfo` con nombre, logo, colores, tipo y descripciones.
- **Theming dinámico**: los colores, logos y textos de marca se inyectan mediante variables CSS o theme providers. El encabezado y los puntos clave de la UI usan el branding retornado sin hardcodear municipios o PYMEs.
- **Contenido adaptado**: componentes como noticias o páginas de perfil muestran la información del tenant cuando el backend la expone. Textos de ayuda o bienvenida se leen de configuraciones del tenant.
- **Contexto anónimo persistente**: se conserva un identificador en `localStorage` (o token JWT en links de WhatsApp) para asociar carritos y puntos sin requerir login, validado siempre por el backend.

## 2. Presentación del catálogo: venta, donación y canje
- **Modalidad visible en tarjetas**: cada producto muestra si es donación o canje (iconos/badges) y presenta el precio como `$` o `X puntos` según corresponda.
- **Filtros rápidos**: tabs o botones para ver solo canjeables, donaciones o compras regulares; opcionalmente secciones separadas por modalidad en la página inicial.
- **Detalle de producto contextual**: acciones y mensajes cambian por tipo ("Donar este ítem", "Canjear por X puntos", "Agregar al carrito - $precio"). Variantes de empaque se muestran como opciones si el backend las entrega.
- **Diseño de tarjetas**: grillas modernas con imágenes o placeholders generados, microanimaciones al hover y botones claros para ver detalles.

## 3. Carrito de compras y uso de puntos
- **Feedback al agregar**: animación de la imagen hacia el carrito y contador con efecto bounce al sumar ítems.
- **Totales separados**: el resumen calcula en tiempo real totales en dinero y en puntos, mostrando combinaciones como `$1500 + 200 puntos` cuando aplica.
- **Saldo y elegibilidad**: se muestra el saldo de puntos disponible; si no alcanza para un ítem, se deshabilita o explica el motivo. Items de donación marcan precio/subtotal como "Donación".
- **Transiciones suaves**: eliminar o actualizar cantidades aplica animaciones suaves para mantener contexto.

## 4. Perfil de usuario y panel de participación
- **Resumen de puntos y actividades**: bloque "Mi Participación" con puntos acumulados y contadores de encuestas, reclamos o ideas aportados por el backend.
- **Historial de canjes y pedidos**: lista de compras, canjes y donaciones con fechas y estados obtenidos de la API.
- **Preferencias y datos**: formularios para actualizar datos de contacto y opt-ins de notificaciones; si el usuario llega desde WhatsApp con token seguro, se prellenan datos disponibles.
- **Acceso a encuestas/sondeos**: sección que enlaza a encuestas o propuestas del tenant para ganar puntos adicionales.

## 5. Flujo de checkout y pago integrado
- **Rutas según contenido del carrito**: 
  - Solo donaciones: confirmación y agradecimiento sin paso de pago.
  - Solo puntos: resumen y confirmación del débito de puntos.
  - Mixto dinero+puntos: se informa el débito de puntos y se genera preferencia de pago para el monto monetario.
- **Integración con pasarela**: el frontend crea la preferencia (ej. MercadoPago), muestra loader y redirige; la página de retorno consulta al backend para mostrar el estado real.
- **Manejo de errores**: mensajes claros para pago rechazado, puntos insuficientes o conexión fallida, con opción de reintentar o volver al carrito.

## 6. Herramientas admin en frontend
- **Importar catálogo**: carga de archivo con mapeo de columnas editable, vista previa de los primeros registros y progreso/resultado de la importación.
- **Imágenes y variantes**: pasos para subir imágenes asociadas a SKUs y para revisar variantes detectadas.
- **Promociones y kits**: creación manual o a partir de sugerencias de IA, definiendo nombre, lista de productos, precio/beneficio y vigencia; se publican en carruseles de promociones.
- **Personalización del tema**: panel para configurar color primario/secundario, logo y banners. Los cambios se guardan en el perfil del tenant y se reflejan en el tema dinámico.
- **Gestión de pedidos**: listado con filtros por estado y acciones especiales para donaciones (marcar recibido) o reintentos de pago.
- **Responsive para admins**: tablas con scroll horizontal y controles táctiles pensados para operación móvil.

## 7. Diseño moderno, animaciones y responsive UI
- **Estilo limpio**: paleta derivada del tenant, componentes consistentes (Material Design u otra librería) y buen contraste.
- **Animaciones sutiles**: transiciones en modales, drawers y filtros usando CSS o Framer Motion sin afectar performance.
- **Mobile-first y PWA**: grillas adaptativas, carrito tipo drawer en móvil, formularios compactos y service workers/manifest optimizados; considerar manifest dinámico por tenant.
- **Internacionalización**: base para textos multilenguaje manteniendo los contenidos provistos por el backend.

## Notas de implementación
- Evitar textos o nombres hardcodeados por municipio/pyme; todo contenido visible debe provenir de la API del tenant.
- Los cálculos de precios, puntos y elegibilidad deben basarse en datos del backend para mantener consistencia.
- Cualquier interacción con identificadores anónimos o tokens debe validarse del lado del servidor.
