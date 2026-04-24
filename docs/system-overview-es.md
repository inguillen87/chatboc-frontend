# Panorama de Chatboc

Este resumen concentra lo que ya ofrece la plataforma y los frentes pendientes para completar la propuesta SaaS de chat conversacional, encuestas y comercio.

## Capas y alcance actual
- **Front web + widget**: interfaz React/Vite en modo white‑label que depende del backend para textos, acciones y permisos, incluida la versión embebible por `<script>` o `<iframe>`.
- **Multi‑tenant**: el aislamiento por municipio o pyme se basa en credenciales o slugs, lo que permite usar el mismo frontend para múltiples clientes sin personalizaciones en el código.
- **Catálogos y carrito**: flujo para subir catálogos, buscar productos y armar carritos con precios y estimación de puntos, pensado tanto para cuentas autenticadas como para visitantes.
- **Encuestas**: módulo de encuestas con plantillas, alta masiva y visualización de resultados, orientado a casos municipales.
- **Canales**: chat web y WhatsApp ya contemplados; los encabezados y tokens indican el tenant y el canal de origen.

## Brecha funcional prioritaria
- **Pagos en línea**: falta integrar una pasarela (ej. MercadoPago) para que los carritos generen órdenes pagables con callbacks de confirmación.
- **Puntos y recompensas**: hoy solo hay estimación de puntos; se requiere historial real, canje y reglas de obtención (encuestas, referidos, compras).
- **Importadores asistidos**: el procesamiento de catálogos existe, pero necesita mapeo flexible de columnas y validaciones para distintos formatos reales.
- **Reconocimiento de pedidos**: aún no hay pipeline de OCR/visión que convierta fotos o PDFs de listas de compra en carritos sugeridos.

## Recomendaciones inmediatas
1. **Cerrar pagos**: exponer endpoint de preferencia de pago, credenciales por tenant y webhook para actualizar pedidos.
2. **Formalizar puntos**: crear servicio y tabla de transacciones de puntos, con reglas configurables por tenant.
3. **Refinar importador**: agregar interfaz de revisión de columnas y plantillas reutilizables por sector/cliente.
4. **Prototipar OCR de pedidos**: iterar con casos de prueba reales y una capa de desambiguación contra el catálogo cargado.
