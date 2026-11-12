# Bandeja omnicanal operativa — septiembre de 2026

## Base y entrada compartida

Base exacta: `bc3790a4c2cb858982796952043980e11f86e833` (PR #1772), observada en producción antes de iniciar el lote. Se trabaja en un worktree independiente, sin sobrescribir otros avances.

El módulo `inbox` publicado por el backend en TenantAdminOperatingSystem abre ahora la bandeja operativa completa. Reutiliza el componente de atención escolar y el editor de conversaciones existente. No hay condiciones ni textos específicos por municipio o empresa: se requiere que la organización del panel coincida con el contexto confirmado.

## Cambios funcionales

- Búsqueda sin distinción de acentos; filtros por canal y estado; vistas de conversaciones cargadas, mensajes sin leer, asignación pendiente explícita y chat en cola; orden por actividad o nombre.
- Indicadores y filtros comparten la colección recibida. No representan el total histórico, no agregan solicitudes al cambiar filtros y no interpretan un responsable desconocido como un caso sin asignar.
- Selección mediante botones nativos y teclado. En móvil se alternan listado y conversación, con regreso y foco; encabezado y editor permanecen visibles mientras contexto e historial se desplazan.
- El contexto del caso es plegable y comienza cerrado para priorizar la conversación: SLA, información del canal y acciones permanecen disponibles sin desplazar la conversación fuera de pantalla.
- Se confirma el descarte antes de cambiar de caso o filtro con un borrador sin guardar. Guardar borrador conserva el comportamiento existente de almacenamiento local; no crea una tarea, recordatorio ni mensaje externo.
- Un detalle fallido no se sustituye con la ficha parcial del listado para habilitar escrituras. Las denegaciones retiran el contenido visible y el borrador local correspondiente.
- Enviar requiere una acción de respuesta publicada y habilitada por el servidor. Un bloqueo sincrónico evita dos envíos simultáneos desde este editor; se conserva el contrato existente de identificación/idempotencia de la respuesta.
- Las respuestas de otra organización o de otro caso se rechazan antes de presentarlas como guardadas. Las sugerencias actualizadas no sustituyen un borrador manual, ni una confirmación tardía actualiza otra sesión.

## Contratos y calidad de datos

La frontera de API verifica la organización cuando la respuesta incluye identidad explícita. Los contratos legacy sin identidad siguen dependiendo de la autorización del backend; la validación del cliente no la reemplaza.

Las fechas ausentes ya no se convierten en actividad o eventos ocurridos ahora. El normalizador preserva mensajes y cambios de estado que llegan dentro de `payload`. Un mensaje saliente sin recibo no se marca automáticamente como enviado. Entrega al proveedor, cola y registro solo en CRM conservan sus diferencias.

El detalle solo acepta endpoints internos `/api/` y se comprueba la identidad de la respuesta. Las acciones conservan los controles de identidad y los reintentos de compatibilidad existentes del transporte; no se afirma exactamente-una-vez de extremo a extremo por bloquear un doble clic.

## Verificación y límites

Cuatro regresiones nuevas se ejecutaron sobre el editor de la base `bc3790a`: cuatro fallaron por detalle no verificado, permiso de respuesta no respetado o borrador reemplazado. Se restauró el código nuevo antes de ejecutar la suite completa. No se eliminaron pruebas; los tests previos que escribían antes de hidratar el detalle ahora esperan la lectura verificada.

El recorrido de Chromium usa la bandeja, React Query, normalizadores de API e identificación de respuesta originales, con transporte, datos y organización sintéticos. Evalúa escritorio, móvil oscuro y 320 px; teclado, filtros sin lecturas extra, borrador, retorno móvil, descarte cancelado, mensaje registrado solo en CRM, detalle retirado tras 403, contraste y desplazamiento. Los escenarios no envían mensajes a clientes.

El primer recorrido detectó problemas reales de contraste y una región de historial sin foco de teclado. Se corrigieron estilos y estructura: encabezado/editor fijos, contexto plegable y una única región central desplazable. No se quitó el control de accesibilidad para obtener aprobación.

Las cifras finales de TypeScript, suite completa, navegador y CI se registran por SHA en el PR. La presencia del workflow o del documento no constituye aprobación ni publicación.

Este corte no modifica credenciales, teléfonos, plantillas WhatsApp, bases de datos ni roles. No incorpora las ramas pendientes de encuestas/white label, no rediseña la landing y no agrega nuevos conectores sociales. La aceptación autenticada de Junín y Tierra del Fuego permanece separada de estas pruebas sintéticas.

La entrega a un canal depende del proveedor y de sus recibos; guardar solo en CRM no se presenta como entrega de WhatsApp. Persistencia de oportunidades, tareas, responsables y vencimientos comerciales requiere su correspondiente contrato backend; no se considera terminada por agregar filtros a la bandeja.

## Publicación controlada

La revisión candidata debe compilar con el verificador de producción existente, validar rutas y SHA, probarse en un deployment sin mover los alias públicos y comprobar que no exista una publicación concurrente. Se preservan las direcciones actuales y la versión anterior de producción para reversión. `preview.chatboc.ar` no se mueve al publicar este lote.

Validacion local final: TypeScript aprobado; 3180 pruebas aprobadas en 405 archivos, 56 nuevas frente a la base. Tres recorridos Chromium aprobados (1440, 390 oscuro y 320), sin infracciones serias o criticas en el alcance evaluado. El resultado CI y la publicacion se registran por SHA en el PR.
