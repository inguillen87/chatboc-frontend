# CRM: navegación operativa de la agenda de seguimiento

Base publicada: `b1ea4a9e7c75b2f47c0ade66f2e3db48f720e0b6`, PR #1790.
Alcance: agenda de próximos contactos del SuperAdmin y retorno desde su editor existente.

## Recorrido cerrado

- Los accesos existentes **Ver vencidos**, **Ver hoy** y **Revisar fechas** eliminan una búsqueda incompatible al cambiar a esa prioridad. Antes podía mostrarse un contador positivo y terminar en una lista vacía por un texto de búsqueda anterior. Los filtros ordinarios siguen combinándose con la búsqueda; no se amplía su resultado silenciosamente.
- Los accesos directos y el restablecimiento de filtros llevan el foco al resumen de resultados y lo ponen a la vista. Repetir el mismo acceso también funciona. La navegación no produce otra consulta al backend.
- Cerrar la ficha sin cambios devuelve el foco al contacto que se abrió, cuando sigue conectado. Si ya no existe, se utiliza la cabecera persistente de la agenda.
- Después de guardar y cerrar, la agenda vuelve a consultar como antes, pero el foco retorna a su cabecera persistente. No se intenta enfocar una fila desmontada durante la carga o que dejó de pertenecer a la prioridad activa. La búsqueda y prioridad se conservan; una respuesta tardía no roba el foco al operador.
- El orden usa únicamente fechas que pasan la validación de calendario y zona. Un texto que Date.parse acepta por normalización, pero no representa una fecha verificable, sigue en la vista de revisión; no recibe un vencimiento inventado. Los empates se ordenan por nombre, organización e identidad, sin mutar la población recibida.
- Se corrigió el contraste del texto de Atención requerida en tema claro, detectado al ampliar axe de la ficha a la agenda completa. Se reutilizan los colores del tema; no hay estilos por municipio/empresa ni nuevos mensajes de negocio.

## Recuperación y pruebas

Se recuperaron pruebas pendientes del worktree `chatboc-crm-agenda-navigation-20260927` en una rama nueva desde producción. El archivo original quedó sin modificar (SHA-256 `71c78b916c140dc82c029a6980cd9b0012c2b748fe2ddee117d388c298096e73`). Sobre la implementación anterior, el grupo produjo 7 aprobaciones y 6 fallos que reproducían los defectos de salto y foco.

Se aisló el mock de guardado entre casos y se fijó el reloj de las pruebas de hoy, evitando depender de la hora de ejecución. Se corrigió también la codificación de fixtures que habían pasado por la consola Windows; no se alteraron datos productivos ni se relajaron comparaciones. La regresión focalizada final aprobó 72 pruebas.

El navegador utiliza la agenda, editor, normalizadores y protocolo de guardado reales con transporte y persistencia sintéticos. Verifica saltos de prioridad, conservación de búsqueda ordinaria, vuelta sin guardar, cancelación y confirmación, una única escritura, fila que sale de Vencidos después del cambio de fecha, consulta retrasada que no mueve el foco, recuperación de filtros vacíos, recarga, conflicto previo y retiro de datos ante denegación. Se comprueban teclado, foco visible, ausencia de desbordamiento, tema oscuro, movimiento reducido y accesibilidad de agenda/ficha.

## Límites preservados

Se mantienen el endpoint global de hasta 100 contactos, su población verificada y las reglas de edición ya publicadas. No se añaden consultas, nuevas rutas, parámetros de URL, almacenamiento de búsquedas/contactos ni campos de negocio. La lectura previa, identidad de organización/contacto, validación del recibo, verificación posterior y bloqueo ante conflicto o resultado incierto no cambian.

Este incremento no activa el módulo independiente de tareas del PR backend #2800: ese corte mantiene pendiente su migración, retención y despliegue coordinado. No se presenta una próxima acción por contacto como un sistema de tareas, calendario o notificaciones. No se modificaron backend, cuentas, permisos, datos de clientes, WhatsApp, infraestructura ni MuniControl.

## Publicación

Se reutiliza `CRM persistent follow-up`, sin cambiar ni duplicar el workflow. La revisión final debe aprobar tipos, suite completa, compilación y Chromium. La evidencia de esta revisión se comprueba por SHA y digest del artifact, sin heredar resultados de otros candidatos.

El despliegue se construye para Production sin asignar dominios automáticamente, con revisión HTML exacta. Se cotejan los aliases actuales antes de promover y se verifican recursos e ingresos públicos después. Preview debe permanecer en `dpl_ChY8GL3PJjnmCYH3qkWVsWg5HHeX`; la base `dpl_6NHgcpMmwLNSxbdUPKP52gBaxgQc` queda disponible para rollback. Los resultados efectivos se registran en el PR y `.vercel/followup-navigation-evidence/publication.json`.

Las pruebas de guardado emplean datos sintéticos y las comprobaciones productivas son públicas/de sólo lectura. No acreditan un recorrido autenticado con contactos de clientes ni pruebas con tecnologías de asistencia reales. Las capturas de móvil se revisan visualmente; axe no sustituye esa evaluación humana completa.

## Resultado local del corte

TypeScript, 3720 pruebas en 441 archivos, compilación y Chromium aprobaron; no hubo pruebas fallidas o pendientes. Son 17 pruebas adicionales respecto de la base publicada. Los tres recorridos (1440×1000 claro, 390×844 oscuro y 320×740 claro) confirmaron una sola escritura sintética, persistencia tras recarga, conflicto bloqueado, conservación de filtros, resultados enfocados y visibles, retorno de foco y ausencia de robo de foco tras una lectura demorada. Axe no registró incidencias serias/críticas en las superficies evaluadas de agenda y editor.
