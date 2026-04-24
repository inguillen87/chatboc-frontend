# Flujo público del marketplace multi-tenant

1. **Ingreso por link o QR**: cada tenant comparte su URL pública `https://<host>/market/<slug>/cart`. El slug viaja en el enlace o QR para abrir el catálogo correcto sin pedir datos adicionales.
2. **Catálogo público**: la vista `MarketCartPage` (ruta `/market/:slug/cart`) consulta `GET /api/market/<slug>/catalog` y muestra los productos con imagen, precio y puntos, mobile-first.
3. **Carrito aislado por tenant**: al presionar "Agregar al carrito" se ejecuta `POST /api/market/<slug>/cart/add` y se refresca el resumen (`GET /api/market/<slug>/cart`) mostrando totales de dinero y puntos.
4. **Checkout simple**: el botón "Ir a checkout" solicita teléfono (y opcional nombre) sólo si no está guardado en localStorage. Luego llama a `POST /api/market/<slug>/checkout/start` y limpia/actualiza el carrito.
5. **Confirmación y seguimiento**: se muestra un mensaje de pedido registrado y se deja visible el contador de ítems y el botón de compartir catálogo para reenviar el enlace por WhatsApp/otros.
