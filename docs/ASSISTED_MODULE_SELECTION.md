# Autoservicio: dependencias revisadas antes de editar

Continúa la línea única #1756 sobre c706b1d y backend #2790 sobre41614510.
Las nuevas opciones y todos sus textos vienen del campo backend opcional
selection_assistance (organization.setup_module_assistance.v1). No se codifican
módulos de negocio o nombres por cliente para calcular dependencias.

Seleccionar una función con prerrequisitos abre una revisión de todas las altas
necesarias, incluidas las transitivas. Quitar una función con dependientes muestra
exactamente qué se retiraría. Cancelar no modifica nada. Aceptar modifica sólo el
borrador; el guardado conserva su confirmación, revisión y recibo de persistencia.
No se conecta ni desconecta WhatsApp, se cambia Full o se otorgan permisos.

El cálculo usa el catálogo validado del servidor y conserva su orden. Rechaza
ciclos, selecciones incompletas, duplicados o referencias inexistentes. La revisión
pendiente se invalida al cambiar tenant, catálogo, revisión, borrador o permisos,
o mientras el editor está bloqueado por lectura/error/conflicto. Los consumidores
sin el contrato opcional válido conservan los controles de dependencias anteriores.

Pruebas nuevas: algoritmo/contrato, revisión/confirmación/cancelación/invalidez de
UI, y separación explícita entre asistencia y PUT en el selector completo. Cuatro
recorridos de navegador usan el componente real y snapshots sintéticos en1440,
820,390oscuro y320; validan teclado, cancelación, alta/baja y ausencia de llamadas
API en este paso. La persistencia se comprueba por separado con el backend.
No se presentan como una sesión institucional, PWA instalada o aceptación Meta.
La CI existente conserva la suite completa, tipos, build y recorridos anteriores.
Resultados exactos se registran en el PR tras comprobar las ejecuciones.

No se modifican dependencias, endpoints o esquema. Publicación pendiente por
acceso autorizado a Vercel; el código subido no implica una versión productiva.
