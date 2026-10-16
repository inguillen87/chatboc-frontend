# Inbox: autoridad de asignación y uso móvil — 2026-09-27

Base: `c4241248428264cc76b209333e465db2a62f0d1f`, PR #1788.
Alcance: exclusivamente `inguillen87/chatboc-frontend`.

## Bloque implementado

1. **Inbox independiente de TicketProvider.** El hook obligatorio `useTickets` quedó aislado en el componente del flujo tradicional. El modo con ticket explícito no lo invoca ni actualiza su selección global. No se agregó un proveedor artificial para ocultar el fallo.
2. **Acciones publicadas, no inferidas.** El control usa la etiqueta del contrato backend `assign`/`claim`. La ausencia, revocación explícita, deshabilitación, duplicación o falta de etiqueta no habilita gestión. Un `allowed_actions: []` no vuelve a tomar acciones de una lista secundaria. Claim no concede asignación y asignación no concede claim; se conservan además roles, capabilities y elegibilidad de routing.
3. **Confirmación de identidad correcta.** El backend recibe la ruta numérica y devuelve `municipio:<id>` para casos legacy. El transporte de asignación verifica modelo, todos los IDs publicados y acción, aceptando esa identidad compuesta únicamente cuando coincide con el caso solicitado. Contradicciones se rechazan. No se modificó la validación de recibos de reply/adjuntos ni se agregó reenvío automático.
4. **Organización publicada en el sobre de respuesta.** El adaptador acepta `tenant.slug`/`tenant_slug` de la respuesta verificada cuando el ticket no repite ese dato. Requiere coincidencia con la organización activa y no la inventa desde la URL, sesión o selector. Un sobre ausente o contradictorio sigue bloqueado.
5. **Historial utilizable en móvil.** La franja de responsable/SLA/próximo paso es horizontal en pantallas angostas, desplazable por teclado y con foco visible. El recorrido comprueba al menos 100 px de historial disponible después de responder a 320 px. El control sigue dentro del scroll del caso y cerrado inicialmente. Los próximos pasos completos permanecen en el contexto detallado.

## Contraste con el backend

Se leyó, sin modificar, `inguillen87/chatbot-backend` en `912446bf96f8330664a9dec009ae57dbf935c73c`: `routes/v2/saas.py`, serializadores `_legacy_claim_inbox_payload`/`_inbox_ticket_payload`, `_atomic_inbox_assignment` y la ruta numérica de acciones. La prueba de navegador usa tickets sin `tenant_slug` local y el tenant publicado en el sobre, como ese contrato real. No se cambian endpoints ni el contrato del servidor.

## Pruebas ejecutadas antes del commit

- Cinco regresiones nuevas de contexto/acciones fallaron sobre la implementación original y aprobaron con la corrección.
- La prueba del recibo original produjo 4 fallos y 18 aprobaciones; con la corrección aprobaron los 22 casos nuevos. El grupo de recibos, scope y routing: 44 aprobaciones.
- Primera regresión completa local: 3616 pruebas aprobadas, cero fallidas o pendientes; TypeScript y build aprobados. Este resultado antecede al último ajuste del adaptador de sobre y no se presenta como suite completa del SHA final.
- Estado final: TypeScript aprobado y 189 pruebas focalizadas aprobadas. La certificación completa del SHA final corresponde al workflow del PR.
- Chromium final: 1440×1000 claro, 390×844 oscuro y 320×740. Los tres recorridos aprobaron sin errores JavaScript ni violaciones serias/críticas en las superficies evaluadas.
- Cada recorrido conserva el control de borrador/cambio de caso, ejecuta una respuesta y una toma de caso sintéticas, verifica el responsable confirmado, retira el control al deshabilitar la acción y retira el detalle ante 403.
- Los componentes, normalizadores y transporte de identidad son reales; el transporte HTTP, organización, usuario y datos son sintéticos. No hay TicketProvider ni un mock de `useTickets` en el navegador.

El primer navegador detectó el recibo compuesto rechazado y el historial colapsado en 320 px. Tras corregirlos detectó la falta de foco del scroll horizontal y una aserción del fixture que buscaba un payload anidado aunque el transporte lo aplana. Se corrigieron accesibilidad y aserción del formato real; no se aumentaron timeouts, forzaron clics ni retiraron controles de seguridad.

Evidencia local: `.vercel/inbox-evidence`. El workflow existente `Omnichannel inbox workspace` cubre tipos, suite completa, compilación y Chromium; se extendieron sus filtros a los componentes de asignación, sin crear otro pipeline.

## Publicación y límites

La publicación exige CI del SHA final aprobado, candidato Production READY sin promoción automática, revisión exacta, comprobaciones públicas y ausencia de un despliegue concurrente. Se preserva `preview.chatboc.ar` en `dpl_ChY8GL3PJjnmCYH3qkWVsWg5HHeX` y el despliegue anterior `dpl_GkPPTDKBK1Fjn4pf1usG3q8TwJsb` para rollback. El PR registra la revisión y el resultado efectivo de publicación.

No se modifican backend, datos de clientes, cuentas, roles, membresías, WhatsApp, webhooks o infraestructura. No se enviaron mensajes ni asignaciones reales para obtener esta evidencia. La provisión de Analía/Conversa, dominios propios, SSO y migración Render→Vercel/Neon siguen fuera de este bloque. MuniControl no se leyó ni modificó.
