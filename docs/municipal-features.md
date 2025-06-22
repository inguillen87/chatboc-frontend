# Funcionalidades sugeridas para municipios

Este documento reúne algunas ideas para ampliar la plataforma orientada a municipios.

- **Panel de estadísticas** de reclamos y consultas, con filtros por rubro, barrio, tipo y tiempo de respuesta.
- **Notificaciones automáticas** por correo electrónico o SMS ante novedades en un ticket.
- **Catálogo de trámites** descargables con buscador y enlaces directos.
- **Gestión de usuarios internos** para los empleados que atienden tickets, con roles y historial de atención.
- **Integración con WhatsApp** para escalar la atención ciudadana.
- **Mapa de incidentes** que muestre geolocalizados los tickets abiertos.
- **Integración con sistemas municipales** como SIGEM o GDE.
- **Encuestas de satisfacción** una vez resuelto el ticket.

## Implementación parcial

Este proyecto incluye una página de **estadísticas municipales** accesible en
`/municipal/stats`, un **mapa de incidentes** en `/municipal/incidents` y una
pantalla de **notificaciones** en `/notifications` para que los usuarios puedan
activar avisos por correo electrónico o SMS. También se provee un **catálogo de
trámites** en `/municipal/tramites`, un listado de **usuarios internos** en
`/municipal/usuarios` y una pantalla para la **integración con WhatsApp** en
`/municipal/whatsapp`. Además se incluye una sección de **integraciones con
sistemas municipales** en `/municipal/integrations` y un módulo de **encuestas de
satisfacción** en `/municipal/surveys`. Todas estas secciones consumen la
información que provee el backend y no requieren configuración por municipio.
