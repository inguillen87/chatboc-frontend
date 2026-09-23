# Guía de preparación sin lenguaje técnico

Implementación: `SetupPreparationGuide` dentro de `TenantBlueprintProvisioningPanel`,
no una nueva aplicación ni una pantalla de muestra desconectada.

Tres pasos de orientación: elegir una base, revisar antes de confirmar y completar
la puesta en marcha. La selección y confirmación continúan en los controles existentes.
La guía no calcula un porcentaje ficticio ni marca WhatsApp como conectado.
El paso actual se deriva del detalle vigente del backend o del recibo de aplicación;
los errores impiden mostrarlo y el estado se reinicia con el contexto existente.

La disposición usa tres columnas cuando hay espacio y una columna en teléfono,
colores del tema y `aria-current=step`. No tiene animaciones esenciales, no añade
bibliotecas, no pide claves ni modifica permisos.

Backend coordinado: nuevo preset `government-disability-support`, con las cinco áreas
identificadas en el plan original de atención accesible. El selector existente puede
consumirlo cuando el backend publique el catálogo actualizado. La opción predeterminada
sigue siendo government-core; no cambiar organizaciones existentes automáticamente.

El nuevo preset guarda configuración preliminar; por sí solo no crea usuarios ni
categorías operativas, no publica contenidos ni activa canales. Aplicar continúa
requiriendo la autorización y el segundo factor existentes en servidor.

Pruebas locales: 4 pruebas nuevas de la guía y 29 regresiones de implementación,
previsualización y segundo factor, total 33. TypeScript y build se registran en el PR.
No se certifica navegador físico, PWA instalada ni aceptación remota con estas pruebas.

Acceso externo pendiente: confirmar correo nominal y preparar invitación segura,
con alcance de evaluación de la organización. No se creó cuenta ni envió invitación
en este corte; el MVP público y sus enlaces no se modificaron.
