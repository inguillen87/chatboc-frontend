# Importación de catálogo: errores seguros y confirmación profesional

Base: `a138f14a063c7dd6ea9fc449215a7d6dd37bbb1f`, actualmente publicada en ChatBoc.

## Cambios
- Se eliminó el `alert()` del asistente clásico de importación.
- Los fallos de upload, guardado y confirmación se convierten en mensajes acotados y accionables.
- Una confirmación ambigua no se considera segura para reintento automático: la interfaz indica revisar el catálogo antes de repetir la acción para evitar una importación duplicada.
- Errores con URLs internas, trazas, SQL, ECONN u otros detalles técnicos no se muestran a la persona usuaria.
- Los errores de validación conocidos (401/403/413/415/422/429/5xx) tienen copy específico sin exponer detalles privados.
- Los errores y warnings devueltos en la vista previa se filtran antes de mostrarse.
- Cuando la confirmación falla dentro de la vista previa en pantalla completa, el error aparece dentro del mismo modal; antes quedaba detrás del overlay e inaccesible.
- Se corrigió copy visible del asistente administrativo: acentos y voseo consistente en las acciones principales.

## Límites
No se cambiaron endpoints, permisos, lógica de commit, mapeo de columnas, modos de importación ni reglas de negocio. No hay reintento automático de commit.
No se afirma que un error de red implique que el backend no haya escrito; por eso el copy de confirmación es deliberadamente conservador.
## Validación
- TypeScript aprobado.
- 14 pruebas del normalizador de errores.
- 2 pruebas de componente del asistente clásico: error de upload y confirmación ambigua.
- La prueba de confirmación verifica que no se use `window.alert`, que no se expongan URL interna/ECONNREFUSED y que se muestre la advertencia contra duplicados.
- La prueba detectó un defecto adicional: el error quedaba oculto detrás del modal. Se corrigió y la misma prueba pasó sin relajar expectativas.
- El workflow dedicado ejecuta además la suite frontend completa y el build antes de permitir promoción.

No se usaron archivos de clientes ni se ejecutó una importación productiva para validar este cambio.
