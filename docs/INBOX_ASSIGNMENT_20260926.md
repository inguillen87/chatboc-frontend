# Inbox: asignación accionable dentro de la conversación

Base productiva: `9d900540ea35d06b5c5f98713e16d3f6f2d35801`.

## Cambio
El detalle omnicanal ya mostraba responsable, pero para gestionar la asignación había que depender del flujo tradicional. Ahora los casos con identidad de routing verificable muestran **Gestionar responsable** dentro del scroll de la conversación.

Se reutiliza `TicketAssignment`: misma matriz `employee.routing.v1`, mismos permisos, compatibilidad por categoría, supervisión, `tickets.assign`, claim, reasignación y protección de concurrencia. No existe un segundo motor de asignación.

Para evitar contaminar el estado global, `TicketAssignment` acepta ahora un ticket explícito. En ese modo no muta `TicketContext`; después de una asignación confirmada refresca el detalle omnicanal y la bandeja. El modo tradicional conserva su comportamiento anterior.

## Fail closed
El adaptador del Inbox sólo habilita el control cuando el caso publica una identidad completa y utilizable: `ticket_id` numérico seguro, `source_model` y `tenant_slug`. Identidades compuestas o incompletas no se convierten ni se adivinan; en esos casos el Inbox conserva sólo la lectura del responsable publicada por backend.

## UX
El control está colapsado por defecto dentro del área desplazable del caso. No roba altura fija al historial/compositor en móvil. Al abrirlo, empleados compatibles pueden tomar un caso y supervisores/capability `tickets.assign` mantienen selector/reasignación según la autoridad existente.

## Validación
- TypeScript aprobado.
- 56 pruebas focalizadas en 4 archivos antes del cierre; se añadió cobertura del adaptador y del modo ticket explícito.
- La prueba de modo explícito verifica una acción real mockeada, callback de confirmación y que no se muta el `TicketContext` global.
- Chromium Inbox: 1440×1000, 390×844 oscuro y 320×740, todos SUCCESS, cero violaciones serias.
- El primer recorrido del fixture falló porque el fixture no tenía `TicketContext`; se aisló ese contexto sintético. Un segundo intento detectó que el control fuera del scroll comprimía 320 px; se movió dentro del scroll. El recorrido final aprobó en los tres tamaños.
- El workflow `Omnichannel inbox workspace` ejecuta suite completa, build y Chromium antes de promoción.

No se modifican contratos backend, reglas de routing, permisos, datos de clientes ni asignaciones reales durante la prueba.
