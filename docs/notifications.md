# Correcciones y contratos de notificaciones (email, SMS, WhatsApp)

Este documento resume los puntos a validar para que las notificaciones transaccionales funcionen en el flujo de tickets multitenant (ciudadanos, agentes y admins). Incluye endpoints, payloads y hooks de backend requeridos.

## Endpoints que disparan notificaciones
- **POST /tickets/<tenant>/create**: tras crear el ticket se envía acuse de recibo al ciudadano (email/SMS/WhatsApp según datos disponibles). Incluye número de ticket y enlace de seguimiento.
- **PUT /tickets/<tenant>/<ticket_id>/estado**: después de `db.session.commit()` invocar `send_ticket_update_email(ticket)` y equivalentes `send_ticket_update_sms/whatsapp` si hay teléfono y opt-in. Destinatarios: ciudadano y, si aplica, agente asignado cuando pasa a "resuelto" o "requiere acción".
- **POST /tickets/<tenant>/<ticket_id>/mensajes**: cuando el ciudadano responde, notificar al agente/admin; cuando el agente responde, notificar al ciudadano. Se reutiliza el mismo servicio de correo/SMS/WhatsApp.
- **POST /tickets/<tenant>/<ticket_id>/assign**: al asignar un ticket a un agente, enviar aviso al agente con categoría y SLA estimado.
- **POST /tickets/<tenant>/<ticket_id>/send-history**: envía historial completo al correo del ciudadano; usarlo también en cierres mensuales.

## Payload esperado (cambio de estado)
Ejemplo de solicitud:
```http
PUT /tickets/municipio/293/estado
Content-Type: application/json
{
  "estado": "resuelto",
  "comentario": "Se reemplazó la luminaria",
  "notificar": { "email": true, "sms": true, "whatsapp": true }
}
```
Respuesta sugerida:
```json
{
  "ok": true,
  "ticket_id": 293,
  "delivery": {
    "email": "sent",
    "sms": "queued",
    "whatsapp": "skipped"
  }
}
```

## Hook de backend tras actualizar estado
```python
# routes/tickets.py
@bp.put("/tickets/<tenant>/<int:ticket_id>/estado")
def update_estado(tenant, ticket_id):
    data = request.get_json()
    ticket = Ticket.query.filter_by(id=ticket_id, tenant=tenant).first_or_404()
    ticket.estado = data["estado"]
    ticket.comentario = data.get("comentario")
    db.session.commit()

    contact = {
        "email": ticket.email_ciudadano,
        "phone": ticket.telefono_ciudadano,
    }
    send_ticket_update_email(ticket, contact)  # usa MAIL_* de config.py
    send_ticket_update_sms(ticket, contact)    # requiere TWILIO_* configurado
    send_ticket_update_whatsapp(ticket, contact)
    return jsonify({"ok": True, "ticket_id": ticket.id})
```

## Configuración requerida
- **Correo SMTP**: `MAIL_SERVER`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_USE_TLS`/`MAIL_USE_SSL`, `MAIL_DEFAULT_SENDER`.
- **Twilio SMS**: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM`.
- **Twilio WhatsApp**: `TWILIO_WHATSAPP_FROM` (formato `whatsapp:+XXXXXXXX`).
- Registrar errores de conexión/envío en logs para evitar fallos silenciosos.

## Plantillas de mensaje
- **Creación de ticket**: asunto "Ticket #{id} recibido"; cuerpo con número, categoría y enlace de seguimiento.
- **Cambio de estado**: asunto "Ticket #{id} actualizado a {estado}"; incluir comentario y timestamp.
- **Respuesta en hilo**: citar último mensaje y adjuntar link al portal.
- **Resumen mensual o historial**: adjuntar tabla con estados y mensajes, más enlaces a archivos si existieran.

## Lista de pruebas manuales
1. Crear ticket de prueba con email y teléfono; verificar recepción de correo/SMS/WhatsApp según flags.
2. Cambiar estado a "en_progreso" y luego a "resuelto" confirmando que los avisos lleguen al ciudadano y al agente.
3. Enviar mensaje desde el ciudadano y comprobar que el agente recibe alerta; responder y validar alerta inversa.
4. Solicitar `POST /tickets/<tenant>/<id>/send-history` y confirmar que el historial llega al correo configurado.
5. Revisar logs de backend para detectar errores de credenciales SMTP/Twilio y reintentos.
