# Marketplace público multi-tenant

Flujo pensado para catálogos compartibles por enlace o QR:

1. **Ingreso por QR/URL**: cada tenant tiene su ruta única `/market/:slug/cart`. El visitante llega al catálogo con el slug ya resuelto y puede explorarlo sin autenticación.
2. **Catálogo público**: se listan productos, precios y puntos consumiendo `GET /api/market/:slug/catalog`. El header muestra logo/nombre del tenant de manera white-label.
3. **Carrito aislado por tenant**: las acciones de agregar producto envían `POST /api/market/:slug/cart/add` y sincronizan `GET /api/market/:slug/cart` periódicamente. No se mezclan ítems entre tenants.
4. **Checkout simplificado**: al presionar “Ir a checkout” se usa el teléfono (y nombre opcional) disponible localmente. Si falta, se abre un modal para completarlo y luego se llama a `POST /api/market/:slug/checkout/start`.
5. **Persistencia mínima**: se guarda contacto por slug en `localStorage` para acelerar futuros pedidos del mismo tenant sin credenciales extras.

La experiencia es mobile-first, con CTA flotante al resumen del carrito y opción de compartir el catálogo (Web Share API o portapapeles). Los mensajes de privacidad enlazan a `/legal/privacy` y se evita hardcodear textos específicos por municipio o pyme.
