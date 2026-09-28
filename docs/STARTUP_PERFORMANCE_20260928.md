# Arranque: gráficos bajo demanda sin cargarlos para resolver clases CSS

Base publicada: `3bc586e13628815efeb31fa4ac463b7a19640afe`, PR #1791.
Alcance: división de paquetes del build de Chatboc; sin cambios de UI, contratos, datos, permisos ni dependencias.

## Causa y corrección

El chunk de gráficos absorbía `clsx`, una utilidad compartida con `src/lib/utils.ts`. La importación de esa utilidad desde el shell obligaba al navegador a descargar y evaluar `vendor-charts`, aunque no hubiera un gráfico en la pantalla. Retirar únicamente el modulepreload no elimina una dependencia estática de JavaScript.

Se asigna exclusivamente el paquete `clsx` a `vendor-classnames`, normalizando separadores de ruta. Se mantienen el resto de manualChunks, imports dinámicos, nombres con hash, reglas de precarga y precache. No se cambia React, Vite, Rollup ni el lockfile; no se retrasa artificialmente el montaje ni se ocultan errores.

Una prueba inicial con `onlyExplicitManualChunks: true` redujo el tamaño, pero cambió la inicialización entre React y Clerk y falló al abrir el ingreso y activar la PWA. Esa opción fue descartada y no forma parte del cambio final. Se identificó el export concreto de `clsx` en el bundle original y se aplicó la frontera mínima. La corrección puntual aprobó el ingreso compilado y los dos recorridos PWA existentes.

## Mediciones comparables

Builds del mismo árbol base y el cambio puntual, con las mismas dependencias. Los números siguientes son bytes de JavaScript descomprimido solicitados en Chromium local con caché fría y service worker bloqueado para aislar el arranque; no son tiempos de carga ni bytes comprimidos de una conexión real.

| Pantalla | Antes | Después | Reducción |
|---|---:|---:|---:|
| Ingreso, 1440/390/320 px | 2.018.344 | 1.407.759 | 30,25 % |
| Portal móvil | 1.573.643 | 962.875 | 38,81 % |
| Iframe móvil | 2.194.633 | 1.583.889 | 27,83 % |

La cantidad de solicitudes JavaScript se mantiene en esos escenarios: 25, 15 y 36 respectivamente. No se intercambia el ahorro por más solicitudes del navegador. La dependencia de gráficos desaparece de los cinco arranques comprobados y sigue disponible al solicitarla explícitamente.

El precache de la PWA pasa de 3.710.168 a 3.099.938 bytes descomprimidos, conserva 73 recursos y mantiene sus límites existentes: menos de 80 recursos y menos de 4 MiB. Las estimaciones gzip del informe de build son sólo una compresión reproducible, no una medición de tráfico real.

## Pruebas de arquitectura y ejecución

`scripts/startupGraph.mjs` recorre imports estáticos del manifest (no imports dinámicos), deduplica dependencias y audita main, portal, iframe y la entrada institucional. Bloquea gráficos, PDF, compresión, exportadores, mapas y diagramas en esos arranques, además de aplicar límites explícitos de tamaño. La base anterior falla esta comprobación porque carga gráficos por la utilidad CSS; el candidato corregido aprueba.

El navegador usa el build final minificado, no un servidor de desarrollo que recompile componentes. Comprueba ingreso en 1440/390 oscuro/320, portal e iframe móvil, errores JavaScript, desbordamiento y accesibilidad del formulario. El transporte de aplicación se responde como no autenticado y las escrituras se bloquean. No se ingresan credenciales ni se usan datos de clientes.

Después de medir el arranque se importa explícitamente el bundle emitido de gráficos y se dibuja un gráfico de tres barras con Chart.js real: se comprueban cantidad de barras, geometría finita y píxeles pintados. Así, la prueba distingue diferir una función de eliminarla o romper su inicialización. Esta prueba no acredita todos los paneles analíticos autenticados.

Se ejecuta además el archivo existente `pwa-lifecycle.spec.ts`, sin retirar sus aserciones: instalación y control del service worker, recarga offline, entrada de encuestas y portal sin conexión, exclusión del iframe/widget del fallback offline y limpieza de un worker heredado que almacenaba APIs. Se conserva la política de no almacenar respuestas de APIs en el precache.

## Certificación y despliegue

El workflow dedicado `Application startup performance` controla los cambios de build, dependencias, entradas y utilidades compartidas. Ejecuta TypeScript, suite completa, build, presupuesto estático, Chromium sobre código compilado y los dos tests PWA; publica JSON y capturas en `startup-performance-evidence`. No instala paquetes nuevos ni altera los workflows de operaciones existentes.

La publicación exige fuente limpia, CI y artifact de la revisión final, candidato Production READY sin promoción automática y revisión HTML correcta. Antes y después se comprueban los ingresos públicos y el árbol de imports servido, sin autenticación ni modificación de registros.

Se mantiene Preview en `dpl_ChY8GL3PJjnmCYH3qkWVsWg5HHeX`. La versión base `dpl_2V4qm9n4yHXox6rWmS4vmTvearnz` queda como rollback. El resultado efectivo se registra por SHA/deployment en el PR y `.vercel/startup-evidence/publication.json`; un build o una medición local no se presentan como publicación.

## Fuentes y continuidad

Se contrastó el comportamiento de manualChunks con la documentación oficial de Rollup (`https://rollupjs.org/configuration-options/#output-manualchunks`) y la estrategia de build de Vite 6 (`https://v6.vite.dev/guide/build#chunking-strategy`). La opción general onlyExplicitManualChunks no se usa por el fallo de inicialización comprobado en este proyecto.

No se modifica código de CRM, Inbox, pedidos, encuestas, cuentas, autorizaciones, infraestructura del backend o MuniControl. Las funciones existentes siguen en la aplicación. No se declara resuelto el módulo de tareas, la provisión de Analía/Conversa, dominios de clientes ni la migración a Vercel + Neon. Se priorizó un fallo real de arranque comprobable también sin entrar a cuentas de clientes.

## Resultado local

TypeScript y la suite completa aprobaron 3739 pruebas en 442 archivos, sin fallidas ni pendientes (19 pruebas de arquitectura adicionales). El archivo nuevo se ubicó en `src/startupGraph.test.ts`, fuera del directorio build ignorado, y sus 19 casos se repitieron después del traslado para comprobar que formen parte del commit y del CI. La certificación final por SHA se registra en el PR.

Los cinco arranques compilados aprobaron: tres tamaños de ingreso, portal e iframe. No solicitaron el paquete de gráficos al iniciar; la prueba explícita posterior dibujó las tres barras. Las dos pruebas PWA existentes aprobaron después de la corrección puntual. La estrategia general descartada queda únicamente en evidencia local; ni ella ni archivos generados por Playwright forman parte del commit.
