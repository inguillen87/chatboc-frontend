# Modelo multi-tenant vs marketplace centralizado

Este documento resume cómo implementar el marketplace de Chatboc como un SaaS multi-tenant (una tienda por organización) en lugar de un marketplace multi-vendedor único.

## 1. Diferencias clave
- **Multi-tenant (SaaS tipo Shopify):** cada tenant publica su tienda con dominio o slug propio, catálogo y carrito aislados. Se comparte la infraestructura, pero los datos se mantienen separados.
- **Marketplace centralizado (tipo Amazon/Etsy):** todos los vendedores conviven en un solo sitio; suele requerir aprobaciones y administración centralizada de catálogos.
- Para Chatboc se adopta el enfoque **multi-tenant**: cada organización tiene su ruta única (p. ej. `/market/{slug}`), catálogo público y carrito independiente.

## 2. Acceso y autenticación
- Generar enlaces y QR por tenant que apunten directo al catálogo público (ej. `/market/{slug}/cart`).
- Permitir compartir el enlace en WhatsApp o embederlo en el widget de chat.
- Para completar compras o canjes, aplicar autenticación sin fricción (OTP/SMS o inicio de sesión passwordless). Si el usuario ya está verificado por teléfono/WhatsApp, puede continuar sin formularios largos.

## 3. Catálogo y carrito por tenant
- El visitante explora productos (imágenes, precio, descripción) sin mezclarlos con otros tenants.
- El carrito se aísla por tienda y no admite productos de otros catálogos.
- Al confirmar, el pedido se envía al backend del tenant o se integra con WhatsApp/pasarela de pago según la configuración.

## 4. Administración del catálogo
- Cada organización gestiona productos desde el backoffice: crear/editar, cargar imágenes o PDFs, definir atributos y variantes.
- Permitir categorías y subcategorías locales, stock y precios propios.
- El frontend muestra solo lo que entregue el backend, manteniendo la interfaz white label.

## 5. UX/UI inspirada en referentes
- Navegación clara con categorías, filtros y buscador eficiente.
- Diseño responsivo y rápido, optimizado para móviles (muchos accesos vienen desde WhatsApp/QR).
- Checkout simple: acceso visible al carrito y confirmaciones claras (p. ej. "Producto agregado al carrito").
- Mostrar solo lo esencial al comprador; las configuraciones avanzadas quedan en el backoffice (disclosure progresivo).

## 6. Relación con el flujo de encuestas
- Igual que en encuestas, cada tenant tiene un link/QR público y administración propia.
- La diferencia es la lógica de e-commerce: stock, totales dinámicos, carrito y pagos añaden complejidad, pero se reutiliza la arquitectura multi-tenant.
