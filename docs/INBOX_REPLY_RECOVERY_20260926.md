# Bandeja omnicanal: recuperación segura de respuestas

Base productiva: 34711c9ef0c01f68aa216d9819e6eb8a19b6781c.

## Problema cerrado
La bandeja ya reutilizaba correctamente el mismo client_message_id después de un fallo ambiguo, pero el operador sólo recibía un toast genérico. No quedaba visible si el mensaje había sido rechazado o si simplemente no se podía confirmar la entrega.

## Cambio
- Un timeout, 425, 429, 5xx o error de red se muestra como **Entrega por confirmar**, no como “falló” ni como “enviado”.
- El texto redactado permanece en el compositor.
- La interfaz explica que hay que revisar el historial antes de repetir.
- Si se repite exactamente el mismo mensaje tras un resultado ambiguo, se conserva el identificador del intento existente, manteniendo la protección de idempotencia ya publicada.
- Un rechazo definitivo se distingue como **Respuesta no enviada** y permite generar una nueva identidad en el siguiente intento.
- Los errores de respuesta no exponen mensajes técnicos del transporte al operador.
- El aviso queda visible junto al compositor, no sólo como toast transitorio.
- Un resultado confirmado elimina el aviso anterior.
- Cambiar de conversación elimina el estado de error de la conversación anterior.

## UX y copy
Se corrigieron dos textos visibles del panel: “Dirección” y el mensaje de fallo del guardado local. No se cambió el contrato de backend ni se inventan estados de entrega.

## Validación
- TypeScript aprobado.
- 31 pruebas focalizadas de bandeja aprobadas en 4 archivos.
- 7 pruebas nuevas cubren timeout/425/429/5xx, red desconocida y rechazo 403.
- La prueba existente de idempotencia se amplió para verificar el banner visible, la conservación del borrador, ausencia del detalle técnico y reutilización del mismo client_message_id.
- El workflow existente **Omnichannel inbox workspace** ejecuta suite completa, build y Chromium antes de promoción.

No se enviaron mensajes reales ni se modificaron tickets de clientes durante estas pruebas.
