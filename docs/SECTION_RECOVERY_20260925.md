# Recuperación local de secciones del panel

## Alcance
Base publicada: `f3610f47e67bcdef51a62b91c3a6b980796f9262` (#1780). Esta entrega corrige el componente compartido de recuperación y sus llamadas en Reclamos, Estadísticas, Encuestas, Categorías, Mapeo de catálogo y subpaneles de Analítica. No modifica login, white label privado, permisos, endpoints, cuentas ni datos.

## Problemas corregidos
El componente anterior volvía a montar el contenido fallido antes de ejecutar la recuperación. Una función síncrona que corregía la causa llegaba demasiado tarde; una función asíncrona no era esperada. Dos pruebas reprodujeron esos fallos en la base y se mantuvieron después de corregirlos.
Ahora el reintento espera el callback de recuperación y sólo después remonta el bloque. Muestra estado pendiente, deshabilita el botón y rechaza clics repetidos mientras esa operación sigue abierta. Si el callback falla, conserva el mensaje genérico, sin mostrar detalles privados ni crear un bucle automático.
Las respuestas pendientes de una sección anterior no cambian el estado de otra, incluso en cambios A→B→A. Las claves de reinicio son explícitas y primitivas; una nueva instancia del mismo array no reinicia el contenido.
Reclamos, Estadísticas y Mapeo de catálogo dejan de llamar `window.location.reload()` al reintentar. Se remonta únicamente el bloque que falló; los datos y borradores de otras secciones permanecen. Un borrador dentro del árbol que se cayó puede perderse, y la pantalla lo informa. Categorías y Encuestas mantienen sus funciones de lectura existentes, ahora esperadas antes del montaje.

## UX
Tarjeta de recuperación con motivo, estado anunciado a lectores de pantalla, botón de reintento y alternativa para volver al panel. Controles de 44 px, contraste claro/oscuro, foco visible y movimiento reducido. Dentro del escritorio de reclamos, el contenido de recuperación se puede desplazar aunque sólo disponga de 250 px de altura: los botones no quedan inaccesibles por el overflow del panel.

## Evidencia
- 3435 pruebas locales aprobadas / 423 archivos, cero fallidas o pendientes; 14 nuevas respecto de la base. TypeScript aprobado.
- Dos regresiones iniciales fallaron antes del cambio: montaje prematuro y recuperación síncrona demasiado tardía.
- Tres recorridos Chromium en 1440×1000, 390×844 oscuro y 320×740. Página real de Reclamos y componente real, con providers/fallos sintéticos. Se conserva el borrador externo, el contador de navegación permanece en una sola carga inicial, los reintentos asíncronos muestran error/recuperación y no hubo peticiones de escritura. También se comprobó acceso a los controles con un panel de altura reducida.
- Axe no detectó incidencias serias/críticas en la tarjeta evaluada. Las excepciones deliberadas del fixture se cuentan aparte; no se informa falsamente ausencia total de excepciones durante una prueba que las provoca.
- Se revisó la captura móvil. Se corrigió el selector del estado para no confundirlo con un output del fixture; la expectativa de recuperación no cambió.

## Entrega y límites
El workflow `Section recovery and preserved workspace` ejecuta tipos, suite, build y los recorridos sintéticos. Sus resultados y el SHA del deployment se registran en el PR. Publicar exige candidato Production READY, controles públicos de lectura y ausencia de un avance concurrente antes de mover los aliases; se conserva rollback.
No se provocan fallos en cuentas productivas para obtener capturas. Los controles de producción no equivalen a recorrer datos privados ni a certificar cada integración.
Un error boundary maneja errores de render de sus descendientes y, en este caso, el callback de recuperación controlado. No convierte cualquier error HTTP en recuperable, no repara datos inválidos ni ofrece idempotencia de escrituras. El módulo no añade reintentos de envíos, cobros o cambios de estados. La recuperación manual no conserva necesariamente el estado interno de la sección que ya falló.
El footer, cabecera privada, alta de Analía, dominio propio y migración Render→Neon siguen fuera de este lote. No se utilizó esta corrección para alterar esas áreas ni se declara completado el white label.
Referencias de implementación: documentación oficial React, `Component`/error boundaries; W3C WAI, técnica ARIA22 para estados anunciados sin mover el foco.
Comandos: `npm run typecheck`, `npm test -- --maxWorkers=4`, `node tests/section-recovery.browser.mjs`.
