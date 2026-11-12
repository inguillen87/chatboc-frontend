# Diez mejoras concretas para Chatboc: Jelou, respond.io, Humand y ManyChat

Fecha de consulta: **12 de noviembre de 2026**. Pedido y coordinación: [backend #2827](https://github.com/inguillen87/chatbot-backend/issues/2827) y [tanda de Claude en #2829](https://github.com/inguillen87/chatbot-backend/pull/2829#issuecomment-6830389640).

## Decisión recomendada

Priorizar **la prueba de borradores desde pantalla, el editor visual y la distribución con capacidad máxima por operador**. Los dos primeros aprovechan el contrato de Workflow Studio que Chatboc ya tiene; el tercero mejora la operación diaria de una bandeja con varios agentes. La edición trazable de formularios es el siguiente bloque para organizaciones que tramitan solicitudes. Captación por Instagram y experimentos A/B quedan después de cerrar esas operaciones.

Las prioridades son juicio de producto, no compromisos de fecha. Este documento propone trabajo; no implementa funciones ni habilita canales.

## Alcance y método

- **Frontend evaluado:** [`2055b560616f93d2b3c3eaadc13d4966f0a5f045`](https://github.com/inguillen87/chatboc-frontend/tree/2055b560616f93d2b3c3eaadc13d4966f0a5f045), rama de integración de Claude.
- **Backend evaluado:** [`d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1`](https://github.com/inguillen87/chatbot-backend/tree/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1), misma tanda de integración.
- Se siguieron componentes, imports, clientes HTTP, contratos, rutas y servicios. La ausencia se acota a la experiencia y al contrato descritos; no se deduce de un nombre de archivo ausente. No se probó la activación de estas funciones en producción.
- Las capacidades competidoras se verificaron en documentación oficial. No se infieren planes comerciales, disponibilidad universal ni resultados medidos. Los criterios de aceptación que siguen son propuestas propias para Chatboc.
- En Workflow Studio, publicación y rollback son operaciones del plano de configuración: el contrato declara `CONTROL_PLANE_ONLY`, `runtime_effect: false` y el enlace al runtime bloqueado. Agregar editor o simulador no habilita por sí solo ejecución real. Los Meta Flows operados desde el Hub pertenecen a otro circuito. [Contrato backend](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/services/whatsapp_workflow_studio.py#L212-L257).
- **P1:** siguiente bloque operativo; **P2:** ampliación posterior; **P3:** crecimiento comercial, condicionado al canal y al volumen de uso.

## Tabla de las diez brechas

| # | Referente | Capacidad concreta que falta en el alcance revisado | Pantalla de Chatboc donde incorporarla | Prioridad |
|---|---|---|---|---|
| 1 | respond.io | Probar una revisión del workflow con mensajes/contacto sintéticos y ver la traza y los efectos previstos desde la misma pantalla | Plantillas y WhatsApp Operations → Workflow Studio | P1 |
| 2 | Jelou | Editar pasos, conexiones y ramas en un tablero visual conectado al contrato de borradores existente | Workflow Studio → editor | P1 |
| 3 | respond.io | Capacidad máxima y disponibilidad por operador, con espera y destino al vencer el plazo de asignación | Equipo → matriz de asignación; Bandeja | P1 |
| 4 | Humand | Corregir respuestas de una solicitud usando su formulario original, con motivo y versiones consultables | Trámites/Reclamos → detalle de la solicitud | P1 |
| 5 | Humand | Configurar por módulo qué puede consultar y qué puede operar el agente IA, mostrando el permiso efectivo | Integraciones / Agente → herramientas conectadas | P2 |
| 6 | respond.io | Reporte de transiciones comerciales con atribución humano/IA/integración y conversiones sobre recorridos registrados | Seguimiento comercial → Reportes | P2 |
| 7 | Humand | Suplencia temporal de un responsable, con alcance y tratamiento explícito de solicitudes previas/nuevas | Equipo → cobertura temporal; Trámites | P2 |
| 8 | Jelou | Biblioteca de subflujos/herramientas invocables desde otros flujos, con procedencia y versión seleccionada | Workflow Studio → biblioteca reutilizable | P2 |
| 9 | ManyChat | Asistente comentario de Instagram → DM, selección de publicación y métricas de esa secuencia | Integraciones → Instagram; Automatizaciones de captación | P3 |
| 10 | ManyChat | Reparto porcentual entre variantes con asignación persistente por contacto | Workflow Studio / Campañas → Experimentos | P3 |

Las pantallas nuevas dentro de módulos existentes son destinos propuestos, no rutas que se afirme que ya existen. La entrada actual de WhatsApp Operations y su Studio es `/perfil/plantillas-respuesta`, montada por [GestionPlantillasPage](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/pages/GestionPlantillasPage.tsx#L302-L347). Moverla a Integraciones sería otra decisión de navegación. Las secciones siguientes separan lo que ya tiene Chatboc del incremento necesario.

## 1. Simulador accesible dentro del editor

**Referencia:** respond.io ofrece un chat de prueba con contacto sintético editable, reinicio y registro de acciones. Esos datos no modifican contactos reales. Su documentación aclara que el panel no reproduce todos los eventos de una conversación real. [Fuente oficial](https://respond.io/help/ai-agents/how-to-test-ai-agents).

**Chatboc ya tiene:** simulación determinista de un borrador y evento, con `trace`, `proposed_effects` y cero llamadas a proveedores/escrituras. Está expuesta por `POST /api/v2/tenants/{slug}/whatsapp/workflow-studio/simulate`. El cliente frontend valida esa capacidad en el contrato, pero sus acciones exportadas son listar, leer, guardar, revisar, publicar y volver a una versión; el panel no ofrece ejecutar la simulación.

**Evidencia:** [cliente y exports, líneas 816–1000](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/api/v2/whatsappWorkflowStudio.ts#L816-L1000); [ruta, líneas 2638–2667](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/routes/v2/saas.py#L2638-L2667); [simulador, líneas 970–1103](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/services/whatsapp_workflow_studio.py#L970-L1103).

**Incremento y aceptación:** elegir una revisión, ingresar mensaje y datos de prueba admitidos, ejecutar y ver camino/efectos previstos. Reiniciar la sesión sintética debe borrar sólo esa prueba. La UI debe representar los límites del simulador determinista; una conversación generativa completa requeriría un contrato adicional. La prueba no puede publicar, enviar mensajes ni alterar contactos.

## 2. Constructor visual de pasos y ramas

**Referencia:** Jelou permite conectar, mover y reconectar nodos, incluyendo condiciones; también distingue vista de lectura y edición. [Nodos](https://help.jelou.ai/es/articles/11638727-que-son-los-nodos-y-como-funcionan-en-brain) y [modos del canvas](https://help.jelou.ai/es/articles/11536769-27-05-2025-modos-de-edicion-del-canvas).

**Chatboc ya tiene:** grafo validable, revisiones, publicación y rollback del plano de configuración; la conexión de estos workflows al runtime conversacional sigue pendiente. La edición operativa actual usa un `Textarea` denominado `Borrador JSON`; no es un constructor visual. El diagrama ReactFlow de `ServiceJourneyFlow` pertenece a la portada y no edita workflows operativos.

**Evidencia:** [editor JSON, líneas 570–593](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/features/whatsappWorkflowStudio/WorkflowStudioControlPlanePanel.tsx#L570-L593); [tipos de pasos y condiciones admitidos](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/services/whatsapp_workflow_studio.py#L22-L30); [validación del grafo](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/services/whatsapp_workflow_studio.py#L415-L497).

**Incremento y aceptación:** representar los cinco tipos actuales, editar condiciones y conexiones y mostrar errores sobre el paso afectado. Guardar debe producir el mismo esquema y recorrer la revisión/publicación existente. Mantener una forma accesible de editar sin arrastrar y avisar de cambios sin guardar. No hace falta construir otro motor de ejecución.

## 3. Asignación según capacidad y disponibilidad

**Referencia:** respond.io combina distribución por equipo con filtros de presencia y límite de contactos abiertos; cuando no hay un usuario elegible, espera en cola y permite una rama al vencer el plazo. [Fuente oficial](https://respond.io/help/workflows/step-assign-to).

**Chatboc ya tiene:** alcance por categoría/zona/canal/permisos, carga abierta, candidatos, cola de no asignados y preview/apply. El backend aplica una penalización al puntaje por carga (`min(25, workload * 4)`), pero la elegibilidad revisada filtra compatibilidad de categoría: no impone un máximo de carga ni presencia. El payload y editor de alcance tampoco exponen esas políticas.

**Evidencia:** [matriz de asignación](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/admin/EmployeeRoutingMatrix.tsx#L320-L443); [ranking y candidatos, líneas 557–625](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/services/employee_routing.py#L557-L625); [contrato, líneas 805–840](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/services/employee_routing.py#L805-L840).

**Incremento y aceptación:** capacidad configurable y disponibilidad verificable; motivo visible de exclusión; tiempo de espera y destino al vencer. El backend debe aplicar el límite también durante escrituras concurrentes. Una persona fuera de capacidad no recibe el caso aunque tenga el mejor puntaje. La cola existente se amplía con esta política.

## 4. Corrección trazable de respuestas sobre el formulario original

**Referencia:** Humand permite habilitar edición por solicitante/agente, exige motivo y conserva historial. Una solicitud sigue usando el esquema con el que se envió aunque el formulario administrativo cambie después. [Fuente oficial](https://help.humand.co/hc/es-419/articles/55396280200723--C%C3%B3mo-habilito-la-edici%C3%B3n-de-respuestas-de-un-formulario-en-un-servicio).

**Chatboc ya tiene:** corrección conversacional de datos antes de confirmar un reclamo y modificaciones operativas del ticket con eventos. El catálogo de trámites ofrece consulta/descarga, no un ciclo versionado de respuestas enviadas. Encuestas sí conserva releases inmutables del instrumento y tiene una ficha metodológica versionada; ninguna de esas piezas implementa por sí sola la corrección posterior de respuestas de un trámite.

**Evidencia:** [catálogo frontend](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/pages/TramitesCatalog.tsx#L9-L80); [corrección antes de confirmar](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/services/municipio_responder.py#L2535-L2547); [edición operativa de tickets](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/services/v2/ticket_service.py#L554-L678); [releases de Encuestas](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/models_survey_governance.py#L24-L44).

**Incremento y aceptación:** conservar el identificador y snapshot del formulario al ingresar la solicitud. Al corregir, mostrar diferencias, exigir motivo y guardar una nueva versión de respuestas; la historia permanece consultable. Cambiar el formulario publicado no debe reinterpretar respuestas anteriores. Separar la autorización del solicitante de la del agente, según estado del trámite.

## 5. Permisos del agente por módulo: consulta y operación

**Referencia:** en la integración de Sammy con Vacaciones y permisos, Humand separa lectura e interacción. La segunda habilita operaciones, depende de la primera y sigue los permisos personales; el chat presenta un resumen antes de modificar una solicitud. Es evidencia para ese módulo concreto. [Fuente oficial](https://help.humand.co/hc/es-419/articles/56217547504147--C%C3%B3mo-conecto-Sammy-con-Vacaciones-y-permisos).

**Chatboc ya tiene:** catálogo granular de permisos CRM, comprobaciones reales de tenant/rol/recurso y acciones IA/equipo autorizadas por el backend. La configuración editable del bot se centra en nombre, tono, prompt, fallback y marca. En esas superficies no está la ficha por módulo que distingue consulta/operación y explica el permiso efectivo; tampoco se encontró consumo frontend del catálogo `module-permissions`. La brecha es de configuración y visibilidad del agente, no ausencia de permisos ni de confirmaciones.

**Evidencia:** [configuración del bot](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/pages/BotSettingsEnterprise.tsx#L380-L433); [control IA/equipo existente](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/tickets/TicketAiHandoffControl.tsx#L95-L130); [catálogo de permisos CRM](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/routes/crm/routes.py#L57-L77) y [endpoint](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/routes/crm/routes.py#L934-L964).

**Incremento y aceptación:** ficha de cada módulo con capacidades efectivas de consulta/operación y motivo de bloqueo cuando corresponda. El servidor calcula la intersección de permiso del usuario, organización y herramienta. Activar una opción sólo puede ofrecer operaciones admitidas; revocarla se refleja en la siguiente acción. Reutilizar confirmaciones y controles existentes.

## 6. Conversiones comerciales atribuibles a quien hizo avanzar el caso

**Referencia:** respond.io presenta un registro exportable de transiciones y filtros por persona/agente y origen del cambio. Sus campos de atribución se registran desde el 6 de octubre de 2026; importaciones y cambios masivos no equivalen a transiciones activas en ese reporte. [Fuente oficial](https://respond.io/help/dashboard-reporting/reports-lifecycle).

**Chatboc ya tiene:** tablero comercial, cambios de etapa con motivo y usuario, historial por caso y CSV de casos filtrados. `CommercialInsights` calcula distribución sobre los casos cargados y declara que no es un embudo de conversión. El evento normalizado conserva fecha/usuario/etapas/nota, sin la dimensión de origen humano/IA/workflow/integración. El endpoint de historial devuelve los últimos 100 eventos por caso. También hay analítica de pedidos y cohortes: no cubre por sí sola este reporte de transiciones comerciales.

**Evidencia:** [indicadores comerciales, líneas 9–45](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/admin/platform/CommercialInsights.tsx#L9-L45); [tipo de evento, parser y CSV](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/admin/platform/commercialFollowUp.ts#L16-L110); [escritura de etapa](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/routes/admin_tenant.py#L5261-L5306) e [historial acotado](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/routes/admin_tenant.py#L5374-L5412).

**Incremento y aceptación:** eventos comerciales con identidad de recorrido, actor y origen verificables; reporte por período/cohorte con conversión y tiempo entre etapas; acceso al caso y exportación de transiciones. Registrar fecha de inicio de instrumentación y cobertura. No calcular conversiones históricas a partir de la distribución actual ni atribuir eventos viejos sin evidencia.

## 7. Suplencias temporales de responsables

**Referencia:** Humand permite nombrar un sustituto para vacaciones/permisos. Las solicitudes nuevas usan la sustitución y las ya enviadas mantienen al responsable original. No concede automáticamente otros permisos. La adaptación a trámites de Chatboc es propuesta propia. [Fuente oficial](https://help.humand.co/hc/es-419/articles/50782060072083--C%C3%B3mo-configuro-un-aprobador-sustituto).

**Chatboc ya tiene:** alcance persistente por categorías/zonas/canales/permisos, ranking por carga y preview/apply con comprobación de concurrencia. El endpoint de cobertura modifica esas cuatro dimensiones; aplicar una asignación cambia un ticket identificado. No instala una sustitución con vigencia para futuros ingresos. La propuesta es suplencia del responsable operativo; no se presupone que Chatboc ya tenga un circuito general de aprobadores.

**Evidencia:** [edición de alcance](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/routes/v2/saas.py#L1935-L1982); [asignación concreta](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/routes/v2/saas.py#L1993-L2010); [preview y confirmación actuales](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/admin/EmployeeRoutingMatrix.tsx#L237-L270).

**Incremento y aceptación:** responsable sustituido, sustituto, vigencia y categorías cubiertas. Vista previa de alcance y explicación de qué ocurre con casos anteriores. Al vencer la suplencia, las nuevas asignaciones vuelven a la política normal; no se modifica silenciosamente la titularidad histórica. El sustituto debe cumplir los permisos del caso.

## 8. Biblioteca de subflujos y herramientas reutilizables

**Referencia:** el nodo Skill de Jelou invoca otro flujo y retorna al llamador, con selector/buscador y reutilización entre agentes. Las Tools obtenidas del Marketplace de otra compañía se muestran en modo de solo lectura y permiten seleccionar versiones públicas o privadas según permisos. La documentación no acredita diff ni rollback de Tools. [Nodo Skill](https://help.jelou.ai/es/articles/11680490-nodo-skill-reutiliza-flujos-personalizados) y [Tools versionadas](https://help.jelou.ai/es/articles/12226342-3-07-2025-cambios-en-el-funcionamiento-de-las-tools-en-brain).

**Chatboc ya tiene:** workflows versionados por organización y catálogos de plantillas de mensaje. En Workflow Studio, el catálogo de plantillas e import/export están declarados no implementados; el esquema cerrado de pasos no admite invocación de un subflujo. Esto no describe ausencia de herramientas internas del backend ni del versionado existente.

**Evidencia:** [tipos de pasos](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/services/whatsapp_workflow_studio.py#L22-L30); [capacidades de biblioteca, líneas 259–269](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/services/whatsapp_workflow_studio.py#L259-L269); [modelos de workflows](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/models_whatsapp_workflows.py#L19-L40).

**Incremento y aceptación:** empezar con biblioteca interna de la organización, entrada/salida declarada y versión fijada en cada invocación. Una actualización no cambia consumidores hasta que se revise. Detectar ciclos y dependencias rotas. La distribución entre organizaciones requiere reglas de publicación adicionales; no es necesaria para la primera entrega.

## 9. Asistente de Instagram: comentario a conversación privada

**Referencia:** ManyChat guía la selección de una publicación, cualquiera o la próxima, las palabras disparadoras y la secuencia por DM; muestra envíos, clics, CTR y correos recogidos. Sólo admite una automatización de próxima publicación activa a la vez. [Fuente oficial](https://help.manychat.com/en/articles/17742037-quick-automation-auto-dm-links-from-comments).

**Chatboc ya tiene:** preparación de campañas con plantilla y contactos explícitos, limitada en frontend y modelo de datos a WhatsApp/email. La ingesta omnicanal recibe eventos normalizados de un adaptador firmado y persiste mensajes/casos. Eso permite incorporar mensajes de distintos canales, pero no configura la selección de publicaciones, respuesta pública, disparador de comentarios ni secuencia de captación por DM.

**Evidencia:** [payload de preparación](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/admin/CampaignPreparationPanel.tsx#L231-L240) y [canales ofrecidos](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/admin/CampaignPreparationPanel.tsx#L313-L331); [restricción del modelo](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/models_campaigns.py#L90-L93); [ingesta omnicanal](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/routes/omnichannel.py#L159-L207).

**Incremento y aceptación:** selección de publicación y disparador, vista previa, activación por cuenta y resultado por paso con recibos del proveedor. Distinguir el inicio de automatización del DM efectivamente enviado y del clic observado. Un cambio de configuración debe conservar el historial de medición. La disponibilidad se determina con capacidades reales del canal.

## 10. Variantes persistentes para experimentos

**Referencia:** el Randomizer de ManyChat distribuye tráfico por porcentajes; permite que el contacto conserve la rama asignada al volver a entrar. Su documentación advierte que los lotes pueden desbalancear muestras pequeñas; no acredita inferencia estadística automática. [Fuente oficial](https://help.manychat.com/en/articles/17741918-randomizer).

**Chatboc ya tiene:** ramas deterministas con condiciones, revisiones y simulación de workflows, además de recibos por destinatario en campañas. El esquema de `branch` admite `condition/on_true/on_false`, no pesos ni variantes. Cada preparación de campaña conserva una plantilla/cuerpo renderizado; no representa la asignación experimental persistente de un contacto.

**Evidencia:** [operadores soportados](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/services/whatsapp_workflow_studio.py#L22-L30); [esquema cerrado de branch](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/services/whatsapp_workflow_studio.py#L653-L705); [preparación de campaña](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/models_campaigns.py#L57-L78) y [recibos](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/models_campaigns.py#L142-L175).

**Incremento y aceptación:** definir experimento, variantes, pesos y evento objetivo. Guardar la asignación por organización/contacto/experimento; reintentos y reingresos mantienen la variante. Medir entradas y resultado por variante con tamaño de muestra visible. No presentar un ganador con datos insuficientes ni mezclar personas de organizaciones diferentes.

## Capacidades descartadas como falsas brechas

- **Meta WhatsApp Flows y prueba de envío real:** `WhatsappOperationsHub` ya expone Flow ID, validación, sincronización/publicación, destinatario y envío. `routes/whatsapp_rules.py` contiene los endpoints administrativos; `routes/whatsapp_webhook.py` y `services/whatsapp_flow_submissions.py` procesan las respuestas entrantes. No se incluyen como funciones faltantes.
- **Versionado/publicación/rollback del plano de configuración:** ya existen en Workflow Studio; su conexión al runtime sigue pendiente. Los puntos 1, 2 y 8 agregan experiencias específicas sobre ese trabajo.
- **Fuentes de conocimiento y derivación humana:** ya hay navegación a fuentes, fragmentos y controles de handoff. No se presentan como ausencias genéricas.
- **Historial, CSV y distribución comercial:** ya existen; el punto 6 exige atribución y recorridos completos para una nueva métrica.
- **Humand y acuse obligatorio de comunicados:** no se encontró documentación oficial suficiente para incluirlo. **Follow-to-DM de ManyChat** queda fuera por su condición beta/elegibilidad externa. Una petición de roadmap de respond.io tampoco se usó como prueba de función publicada.

## Orden sugerido de entregas

1. **Simulador en pantalla** sobre `/simulate`; después **editor visual** sobre el mismo borrador. Ambos mantienen los controles de publicación y capacidades del servidor.
2. **Capacidad y suplencias de equipo:** primero contrato/política efectiva del backend, después editor y explicación en la matriz.
3. **Versiones de formularios y permisos por módulo:** definir snapshots y operaciones permitidas antes de habilitar controles de escritura.
4. **Atribución comercial y biblioteca reutilizable:** instrumentación durable y contratos de dependencia.
5. **Captación de Instagram y experimentos:** una vez cerrado el circuito real del canal y la medición de resultados.

Cada bloque debe ir en PR acotado a la rama de integración indicada por Claude. Este documento no cambia el alcance de los trabajos de dominios, límite oficial de Tierra del Fuego ni WhatsApp asignados a Codex.
