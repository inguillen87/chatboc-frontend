# Backend prompt para reclamos en vivo

El frontend ya muestra el botón de "Hablar con un representante" y escucha los eventos de Socket.io. Para que la experiencia funcione sin tener que tocar el frontend, el backend debe encargarse de la lógica y enviar la información correcta.

## 1. Emails automáticos
- Reenviar los emails cuando se crea un nuevo mensaje en un ticket de reclamo.
- Notificar tanto al vecino/cliente como al agente asignado.
- Incluir en el email el número de ticket, último mensaje, estado y enlaces directos al panel.

## 2. Actualización en tiempo real del panel de tickets
- Exponer un namespace/canal Socket.io (o Pusher) accesible en `VITE_API_URL`.
- Emitir `new_ticket` con `{ nro_ticket, asunto, ... }` cuando se crea un reclamo nuevo.
- Emitir `new_comment` con `{ ticketId, comment: { comentario, autor, fecha } }` cuando se agrega un comentario.
- Mantener compatibilidad con el endpoint `GET /notifications` que devuelve `{ ticket: true }` si el usuario habilitó las notificaciones.

## 3. Horarios del chat en vivo
- Devolver en `/auth/profile` (usuario autenticado) o `/perfil?entityToken=...` el objeto `horario` con `start_hour` y `end_hour` (horas en formato 24h).
- Opcional: agregar `days` o `dias` si se quiere especificar días distintos a lunes-viernes.
- Cuando el chat en vivo esté habilitado, enviar mensajes del bot con botones `request_agent` para abrir la sala.

## 4. Sala de chat en vivo
- Crear el canal Socket.io para cada ticket: el frontend se une a la sala `ticket_{tipoChat}_{ticketId}`.
- Enviar eventos `new_chat_message` a esa sala cada vez que un agente responde (desde web o WhatsApp).
- Escuchar los mensajes del widget (`action: "request_agent"`) y abrir la sala con el agente disponible.
- Sincronizar los mensajes entre WhatsApp y el widget para que ambos vean la conversación en tiempo real.

## 5. Detección de urgencias
- Analizar los mensajes entrantes; si son urgentes, responder desde el backend con un mensaje del bot y/o iniciar la conexión con un agente.
- El frontend ya no detecta urgencias automáticamente, por lo que cualquier escalamiento debe venir del backend (por ejemplo enviando un botón con `action: "request_agent"`).

Con estos puntos cubiertos en el backend, el frontend mostrará el estado correcto sin agregar lógica extra del lado del cliente.
