# Recuperación: cierre del contrato de presentación

El P1 de textos locales se aborda junto con backend #2791 / c1fa43dc, aislado sobre
la revisión pública 912446bf. La nueva fuente es config/runtime_recovery_ui.json,
servida por GET /api/config/runtime-recovery bajo chatboc.runtime_recovery_ui.v1.
El frontend ya no declara RUNTIME_RECOVERY_COPY ni etiquetas locales de respaldo.
Valida seis estados, textos acotados/sin controles y scope platform; renderiza
texto escapado y descarta propiedades fuera del contrato. Los textos del fixture
se usan sólo en pruebas y corresponden al JSON del backend, no al bundle runtime.

La configuración pública se obtiene con GET anónimo, tiempo límite de ocho
segundos y operación pendiente compartida. La copia validada permanece únicamente
en memoria del documento, sin tokens, cookies, localStorage ni datos de tenant.
La carga inicial no afirma disponibilidad: la revalidación se hace separadamente
con GET /api/version. No se reenvían acciones de negocio.

Sin contrato recibido en una primera visita offline o ante un backend anterior
sin endpoint, la nueva barra no se fabrica; la app y la edición permanecen montadas.
Al reconectar puede obtener el contrato y entonces verificar el servicio.
Esto no certifica pérdida de red física, dispositivos/PWA o sesión institucional.

Las correcciones de política offline y geometría h-dvh se conservan. Los cuatro
recorridos de navegador comprueban edición y borde inferior estable en error,
revisión incompatible, offline y espera, más los cuatro del perfil anterior.
Hay pruebas específicas de mensajes publicados/escapados, ausencia de contrato,
carga tardía, límites, red fallida, deduplicación y timeout de la configuración.

Pruebas del head anterior no certifican este head nuevo. El PR permanece draft
hasta terminar CI y revisar el contrato coordinado. No hay publicación automática.
Debe publicarse y comprobarse el backend antes de presentar esta barra como activa.
Desktop Commander está pausado por cuota; Vercel no dispone de equipo autorizado.
No se cambian permisos, capacidad, bases, números ni callbacks para sortearlo.
