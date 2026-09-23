# Continuidad y autoservicio de WhatsApp por organización

## Decisión de producto

Un solo SaaS, configurado por organización, tipo, plan y roles. Los clientes existentes
conservan usuarios, identidad, número y conexiones; no se vuelven a dar de alta para
recibir mejoras. TDF es un caso white label; Junín es un caso de continuidad. No hay
nombres de clientes ni credenciales codificados en los componentes.

## Implementación

El panel de Tech Provider ahora se remonta al cambiar de organización, valida la
versión e identidad del contrato y descarta respuestas anteriores. Las operaciones
se excluyen entre sí en pantalla y el botón de actualizar no compite con una escritura.
Una respuesta incierta requiere refrescar antes de otra acción; esto no cancela ni
revierte una operación ya recibida por el backend/proveedor.

Los estados se comparan de forma exacta: inactive, disconnected, not_ready y
provisioning_plan_ready ya no se pintan como listo por contener palabras positivas.
Un workflow disponible no acredita plantillas configuradas. done=false no se
convierte en completado porque otro campo diga ready. La presencia de un sender
no acredita una prueba real de entrega ni permiso concedido por Meta.

Si hay un sender registrado, se deshabilitan las acciones de preparación/registro
y la edición del número desde este asistente. El camino es revisar la conexión y
continuar la configuración, incluso si faltan identificadores del onboarding nuevo.
Esto es una protección de interfaz, no un sustituto de la idempotencia/RBAC del servidor.

El bloque opcional whatsapp.self_service.v1 del backend agrega cuatro accesos con
textos por tipo: perfil, módulos/equipo, integraciones y plantillas. Se comprueban
scope y rutas permitidas. Sin ese bloque, el panel anterior sigue funcionando con
las correcciones de estado; los nuevos accesos esperan la publicación del backend.

## Validación y compatibilidad

29 casos nuevos (evidencia, navegación y seguridad) y 15 regresiones del panel.
Se prueban A→B→A con respuestas tardías, rechazo de acceso, estado desconocido,
conexión anterior sin IDs de onboarding nuevo, doble clic y preservación del número.
Cuatro recorridos de navegador usan el componente real y API sintética en 1440,
820, 390 oscuro y 320 CSS px. No son dispositivos físicos ni PWA instalada.
Los fixtures del nuevo contexto se generaron con el builder real del backend.

El primer intento del harness interceptaba también imports bajo src/api: se corrigió
para interceptar sólo /api/. No fue un fallo del backend real. La suite final y la
publicación se registran por revisión en el PR; no reutilizar evidencia del padre.

No se crean conexiones por consultar el panel; no hay mensajes, aprobaciones o
cobros nuevos. No cambia el método de login, los permisos de los clientes, Full,
la identidad del MVP TDF, la base de Junín ni callbacks productivos.
El frontend es compatible con el contrato anterior; los nuevos accesos por vertical
requieren el campo self_service del backend coordinado. No confundirlo con publicar
marca blanca completa, migrar los ocho esquemas pendientes o certificar operación real.

## Referencias actuales y próximos criterios del plan

Consulta: 19 de septiembre de 2026. No son benchmarks de rendimiento independientes.
- respond.io separa cuenta, organización, workspace, canales y equipo y ofrece una
  ruta de onboarding. Adoptar continuidad del espacio, autoservicio y soporte por
  excepción, no repetir el alta del cliente: https://respond.io/help/quick-start
- Jelou describe agentes transaccionales, herramientas conectadas y pruebas previas
  a producción. Priorizar tareas completadas y evidencia, no sumar respuestas que
  sólo parezcan inteligentes: https://jelou.ai/en/
- Twilio documenta Senders v2 y estados explícitos como ONLINE, OFFLINE y
  PENDING_VERIFICATION. El backend inspeccionado ya usa rutas v2; comparar payloads
  y probar el proveedor real sigue siendo requisito, no deducirlo de una URL:
  https://www.twilio.com/docs/whatsapp/api/senders
- React documenta 19.3 como versión reciente. El manifiesto del proyecto usa ^18.2.0;
  planificar la migración de major con revisión de dependencias y recorridos, no
  mezclarla con esta corrección: https://react.dev/versions
- Vite documenta soporte de seguridad para 6.4; el proyecto usa ^6.4.1. Mantener
  parches comprobados y evaluar 8.x por compatibilidad/beneficio medido, no por
  marketing: https://vite.dev/releases

Criterios agregados al plan: SS-CONTINUITY (alta existente sin reprovisión),
SS-SCOPE (perfil/módulos/canales por tipo, plan y rol), SS-DIAGNOSTICS (evidencia
operativa distinta de configuración), DEP-UPGRADE (versión/soporte y pruebas de
migración). Estos trabajos no eliminan las etapas de marca blanca ni Render/Neon.
