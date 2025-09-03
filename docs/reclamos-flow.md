# Flujo de reclamos offline y chat municipal

Este documento resume la lógica sugerida para manejar reclamos ciudadanos y conversaciones en vivo con agentes municipales.

## 1. Detección y recopilación de datos
- **No crear tickets automáticamente.** Al detectar intención de reclamo se inicia un formulario paso a paso.
- Pedir categoría, descripción del problema, foto opcional, ubicación y datos de contacto (nombre, teléfono, email, dirección).
- Solo luego de validar los campos mínimos se genera el ticket y se asigna un número.

## 2. Confirmación y seguimiento
- Responder al usuario con el número de reclamo generado.
- Registrar el ticket con todos los datos adjuntos para que el administrador tenga contexto.
- Enviar notificaciones automáticas por SMS, correo o WhatsApp según la información provista.
- El usuario puede consultar el estado ingresando su número de reclamo.

## 3. Separación de flujos
- **Reclamo offline:** no se abre un chat en vivo. Se almacena el ticket y se muestra el número para seguimiento.
- **Chat en vivo:** se habilita sólo si el usuario elige hablar con un agente. Los mensajes, archivos y ubicación se registran en el ticket vinculado.

## 4. Manejo de archivos e imágenes
- Las imágenes deben mostrarse con vista previa o ícono de descarga en el panel de administración y en la interfaz del usuario.

## 5. Notificaciones
- Implementar envío de alertas automáticas cada vez que el estado del ticket cambie.

## 6. Consulta de tickets
- Permitir que el usuario ingrese su número de reclamo para obtener estado, fecha y comentarios. No abrir un chat nuevo a menos que lo solicite.

- Si el ticket incluye coordenadas válidas, se muestra un mapa basado en OpenStreetMap que traza la ruta desde el municipio hasta la dirección del vecino.
- Cuando no hay coordenadas, se intenta geolocalizar por la dirección textual utilizando el buscador de OpenStreetMap.
- La sección de historial presenta una línea de tiempo en orden cronológico combinando los cambios de estado y los mensajes enviados por agentes y vecinos.

Estas pautas están orientadas a mejorar la experiencia tanto del ciudadano como de los administradores del municipio, asegurando que se obtenga toda la información necesaria antes de crear un reclamo y que el seguimiento sea claro y eficiente.
