# Checkout público: sesión, envío y recibos actuales

Base publicada: `aabfa1a6ff575014674801abf3d9a4627330dfaf` (#1794).
Alcance: MarketCheckoutPage y su máquina de presentación; sin cambios en pagos, backend o credenciales.

## Recorrido implementado

- Un bloqueo síncrono cubre preflight y creación de checkout. Dos clics antes del render de React no inician dos intentos. Tras invocar la creación, el mismo montaje no permite reenviar, tampoco si la respuesta falla o resulta incierta. No equivale a idempotencia del servidor ni entre sesiones/navegadores.
- Organización distinta implica nuevo proveedor de carrito y nueva sesión de formulario. Una comprobación pendiente de la vista anterior no inicia una orden; una creación ya enviada no aplica su respuesta ni refresca el carrito de la vista nueva.
- Antes de crear se coteja que artículos/cantidades y elegibilidad actuales sigan correspondiendo al preflight. Los datos de contacto quedan bloqueados mientras se procesa para que el cuerpo enviado no cambie silenciosamente.
- Se retira el almacenamiento local de recibos y datos de contacto del checkout. La clave heredada del tenant abierto se elimina al montar. Los helpers de compatibilidad no restauran estados, identidades, enlaces ni PII; no se usan como confirmación tras recargar.
- Las respuestas vacías, rechazadas o sin evidencia de orden/preferencia no se presentan como registro exitoso. Los enlaces de pago requieren HTTPS sin credenciales incrustadas, controles o backslashes; los aliases publicados deben coincidir. No se inventa una lista de proveedores ni se certifica reputación del dominio.
- Se preservan recibos de preferencia sin ID de orden y las identidades distintas de pedido heredado/market_order. Se cotejaron confirmado y pendiente_pago con `routes/checkout.py` del backend de referencia `912446bf96f8330664a9dec009ae57dbf935c73c`.
- Actualizar el carrito es una lectura posterior separada: un fallo de esa lectura no sustituye la respuesta de checkout ni habilita otra creación. No se declara un pago confirmado a partir de este recibo.
- El formulario permite enviar con Enter, ofrece autocomplete y teclado telefónico, y lleva el foco al resultado actual. Se reutilizan títulos/botones existentes y mensajes publicados, sin textos comerciales nuevos. Las etiquetas del aviso de pago recibieron contraste de tema oscuro.

## Pruebas

La primera ejecución de los tests de página heredaba un mock global de useParams. Se retiró únicamente ese mock dentro del archivo para usar MemoryRouter real y se repitieron las regresiones sobre la fuente original: 26 fallos y 2 aprobaciones. Luego se restauró la implementación corregida. No se usa el primer error de montaje como prueba del defecto.

Se cubren doble envío síncrono, fallo de carrito posterior al recibo, almacenamiento local forjado, ausencia de escritura de PII/URLs de checkout, cambio de tenant durante preflight/creación, error previo sin orden, resultado incierto sin reenvío, artículos/eligibilidad cambiados, envío por formulario, foco, carga inicial y StrictMode. La máquina conserva tests de transiciones y diferencia recibos publicados de estado local.

## Navegador y límites de prueba

El navegador monta MarketCheckoutPage con MarketCartProvider y API de marketplace reales; sólo HTTP y telemetría de QA están sustituidos. No usa credenciales ni contacta pasarelas. En cada tamaño prueba error de preflight con recuperación explícita, doble clic mientras espera, envío con Enter, respuesta aceptada con fallo posterior del carrito, URL rechazada, preflight obsoleto y respuesta tardía después de cambiar de organización. Los tres inicios de checkout y cinco preflights de cada escenario son sintéticos; nunca se abre el enlace externo para realizar un pago.

La primera corrida detectó contraste insuficiente de las etiquetas del aviso de pago en tema oscuro. Se corrigieron las variantes oscuras del componente manteniendo colores del sistema y los textos existentes. También se restringió el escaneo de dependencias de Vite a la entrada del fixture: escanear todas las entradas de la aplicación bajo un transporte parcial producía errores por exports ajenos al checkout. No se ocultaron errores de la página ni se redujeron aserciones de accesibilidad.

## Lo que esta entrega no afirma

El bloqueo es por montaje del checkout. No es una clave de idempotencia persistente del servidor ni reconciliación contable; volver a montar, otra pestaña o navegador requieren protección backend adicional. No se reintenta automáticamente una creación de resultado incierto desde esta vista. Se conserva el mecanismo existente de selección/fallback de endpoints de la API compartida, por lo que una invocación de startMarketCheckout no equivale universalmente a un único POST de red.

Al retirar la vista no se cancela una solicitud que ya llegó al servidor: sólo se evita aplicar su respuesta al formulario nuevo o continuar después del preflight obsoleto. La identidad de la orden procede del recibo actual de la ruta autenticada/guest-safe; no se verifica un tenant extra que el normalizador no publica.

Se elimina únicamente la clave heredada de checkout del tenant visitado. No se declara saneado todo localStorage ni se modifica la persistencia compartida del carrito. Los precios, descuentos, stock, cálculos de importes, datos de clientes, permisos, cuentas y backend no cambian. No se afirma pago confirmado a partir del estado de checkout ni se modifica MuniControl.

Referencias de implementación revisadas: documentación oficial React sobre reinicio de estado mediante key (`https://react.dev/learn/preserving-and-resetting-state`) y `routes/checkout.py` del backend de referencia, consultado sin modificarlo. El esquema de preferencia con URL y el pedido monetario pendiente siguen diferenciados del pago efectivo.

## Publicación

El workflow existente de pedidos incorpora el recorrido de checkout y su evidencia. El workflow de rendimiento sigue verificando toda la aplicación, presupuestos de arranque, gráficos bajo demanda y PWA offline. La publicación requiere ambos CI del SHA final, artifacts verificados, candidato Production READY construido sin asignación automática de dominios y controles públicos antes/después.

Se preserva Preview `dpl_ChY8GL3PJjnmCYH3qkWVsWg5HHeX` y el rollback `dpl_6s6j7ArrUvhK2dxmFsCTZVzHNUJC`. El resultado real de publicación y revisiones está en el PR y `.vercel/checkout-evidence/publication.json`; este documento no sustituye esos controles.

## Validación local del corte

Aprobaron TypeScript, **3846 pruebas en 446 archivos** (37 adicionales respecto de la base, sin fallidas ni pendientes), compilación de producción y Chromium. Los tres recorridos de 1440×1000 claro, 390×844 oscuro y 320×740 claro verificaron tres inicios de checkout y cinco preflights sintéticos por escenario, sin transacciones reales. No hubo errores JavaScript ni desbordamiento; axe no registró incidencias serias/críticas en el formulario y resultado evaluados. Se revisó visualmente la captura móvil oscura.

El aviso de fallo del carrito pertenece a su contexto compartido y puede seguir visible junto al resultado recibido. Esta entrega no lo oculta: mantiene la distinción entre una lectura posterior fallida y un checkout ya iniciado. Los resultados definitivos de CI corresponden al SHA publicado, no se infieren desde esta ejecución local.
