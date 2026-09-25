# Encuestas: cierre de publicación en producción

Base online verificada: `a7e2b3eb64917b2702d6bfd935d0581d5b8fafa0`, deployment `dpl_7KuSQNcjyr8QLD4FCRgjCfnueyZr`. Se mantiene el PR #1777 y su historial, sin mezclar tareas, encuestas A/B, migraciones ni la base de datos.

## Error observado
El deployment Git Preview `dpl_AufGm7Lu2555vsobVWP4wQdzGoF1` falló porque `guardVercelPreviewRewrites` impidió que apuntara al backend productivo. El guard permanece sin cambios.
Se agrega `ignoreCommand` para omitir sólo previews automáticos de GitHub. Producción no se omite; la ruta de preview manual conserva la protección de rewrites. El resultado de un preview omitido no se presenta como un despliegue de producción exitoso.

## Validación visual completada
Se añadió `tests/survey-card-production.browser.mjs` con tres recorridos Chromium: 1440×1050 claro, 390×844 oscuro y 320×740 claro. Usa el componente real con registros y callbacks sintéticos, sin escribir encuestas del backend.
La primera ejecución encontró contraste insuficiente del botón de borrado y pérdida de semántica del listado de métricas por aplicar `role=group` directamente a `dl`. Se corrigieron la agrupación accesible y el botón, conservando las pruebas de axe. Los tres recorridos posteriores aprobaron y se revisaron capturas móvil/diálogo de escritorio.
Se verifican datos ausentes frente a cero, cobertura contradictoria, controles durante generación, cancelación sin cierre, un cierre confirmado, error de eliminación visible, teclado, movimiento reducido, objetivos táctiles de 44 px y ausencia de desbordamiento. Cero violaciones serias/críticas en los alcances axe evaluados.

## Publicación verificable
El workflow ejecuta la política de preview, los guardas existentes, TypeScript, suite completa, compilación y los tres recorridos de navegador. Los resultados deben corresponder al SHA final.
La publicación se prepara con build de producción y sin asignación automática de dominios; sólo se mueve el tráfico después de comprobar el deployment y que la versión pública no haya avanzado. Se conserva el deployment anterior y el alias preview no se mueve.
Se comprobarán el SHA servido, recursos iniciales y rutas protegidas sin sesión. No se afirma validación de acceso de cada cliente o envío de mensajes a partir de pruebas sintéticas o anónimas.
El resultado final y los identificadores de despliegue/CI se registran en el PR #1777. No se modifican credenciales, variables remotas, base de datos, DNS de API ni canales WhatsApp.
