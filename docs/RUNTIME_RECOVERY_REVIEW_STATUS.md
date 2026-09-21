# Estado de revisión de la recuperación

Este documento complementa PRODUCTION_RUNTIME_CONTINUITY.md. No está autorizado
marcar este corte como listo para promover sólo porque la CI esté verde.

## Correcciones funcionales de revisión
La política de deshabilitación se aplica tanto al montaje inicial sin conexión
como al evento offline. Cuatro pruebas nuevas cubren función deshabilitada,
ruta excluida, retiro de una barra previa y ausencia de comprobación al reconectar.
La barra es fixed, no sticky dentro del flujo del documento. El fixture de
navegador reproduce un espacio h-dvh con root/body sin scroll y comprueba la
posición y visibilidad del extremo inferior antes, durante y después de recuperar.
Los recorridos son sintéticos y no certifican el Layout completo con sesión real.

## P1 pendiente: textos gobernados por el backend
La revisión 4058846875 es válida. RUNTIME_RECOVERY_COPY y etiquetas de botones
siguen definidos en frontend; eso no cumple AGENTS.md. No se resuelve trasladando
los mismos literales a otro archivo del frontend ni dando por aprobados los textos.
La fuente pública actual comprobada es routes/config.py del backend productivo
912446bf96f8330664a9dec009ae57dbf935c73c. Expone /api/config y /api/version, pero
no un contrato de mensajes de recuperación. Falta añadir un contrato público
acotado y consumirlo sin inventar texto, datos de tenant ni éxito de operaciones.
También debe definirse la conducta sin configuración recibida/al iniciar offline.
Esta tarea requiere una entrega coordinada del backend, separada de la migración.
El PR permanece draft y el hilo P1 abierto hasta completar esa integración.

## Despliegue
No desplegado ni promovido. Además del P1, el acceso local está pausado por cuota
de Desktop Commander y el conector Vercel no dispone de equipo autorizado.
No se modificaron producción, bases, números, permisos o capacidad contratada.
