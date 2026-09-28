# Pedidos: importes fieles a la respuesta del servidor

Base: `2fcf544bbcbd19c0c7d5c7fa6e941e3e3fedcbc7`, PR #1789.
Alcance: frontend de Chatboc; normalización y presentación de pedidos.

## Bloque implementado

- Se eliminan los valores inventados del normalizador administrativo: cantidad 1, precio 0, moneda ARS, subtotal calculado y total reconstruido sumando artículos. Un cero explícito se conserva como dato informado.
- Importe, cantidad y moneda distinguen datos informados, ausentes, inválidos y contradictorios. Aliases redundantes deben coincidir; no se elige uno frente a otra cifra incompatible.
- Los números decimales en texto se aceptan sin adivinar separadores locales ni convertir booleanos, notación hexadecimal o exponentes en importes. Se rechazan pérdidas detectables de precisión, negativos, infinitos y valores fuera del rango de presentación.
- El subtotal recibido no se sustituye por precio × cantidad. Un descuento, una bonificación o cargos adicionales pueden explicar que subtotal y total difieran; la interfaz no los reconstruye ni inventa su causa.
- La moneda se muestra explícitamente. Una línea puede heredar la moneda informada del pedido cuando no publica una propia; el total del pedido nunca toma moneda desde una línea. No hay conversión de divisas.
- Un desglose compartido presenta cantidad, precio unitario, subtotal y total. Se integra en ficha administrativa, listado y modal comercial, ficha del tablero anterior, portal autenticado, portal derivado del widget y seguimiento público.
- El tablero anterior deja de sumar distintas monedas bajo un único total en pesos. Publica grupos por moneda, pedidos incluidos y excluidos, y el alcance de los registros cargados. Las sumas usan enteros escalados, no adición binaria de decimales; no representan cobros confirmados ni el universo histórico.

## Contrato y límites

`Order.total`, cantidades y precios admiten `null`; `amount_evidence` es una proyección de presentación calculada en el cliente. La normalización sobrescribe cualquier campo homónimo recibido para no aceptar una evaluación prefabricada como fuente de autoridad.

Se consultaron, sin modificar, `services/commerce_unified.py`, `routes/orders.py` y `routes/portal_api.py` del backend en `912446bf96f8330664a9dec009ae57dbf935c73c`. Los serializadores del servidor todavía contienen valores por defecto propios. Cuando el servidor ya publicó cero o ARS, el frontend no puede reconstruir si provienen del dato original o de ese fallback. Esta entrega evita nuevas invenciones en el cliente; no certifica la procedencia contable de lo recibido.

No se cambian endpoints, payloads de mutación, estados operativos, autorización, pagos, stock, políticas de descuentos, datos de clientes, sesiones, infraestructura o webhooks. La separación de pedido/pago/entrega y las guardas de identidad, confirmación y recuperación de la ficha permanecen vigentes. MuniControl no forma parte de este trabajo.

## Pruebas

Catorce regresiones de importes fallaron sobre el normalizador original. Las pruebas nuevas cubren datos ausentes, ceros explícitos, subtotales descontados, alias contradictorios, monedas, precisión decimal, sumas separadas, contexto de tenant y conservación del payload de cambio de estado.

La validación local final aprobó TypeScript, **3701 pruebas en 440 archivos**, compilación de producción y Chromium. Son 72 pruebas adicionales respecto de la base publicada, sin fallidas ni pendientes. La primera suite encontró una expectativa exacta del normalizador de portal que no incluía el nuevo objeto de evidencia; se amplió con sus campos y estados esperados sin quitar las aserciones anteriores, y se repitió la suite completa.

El navegador ejecutó las páginas reales de detalle administrativo y seguimiento público a 1440×1000 claro, 390×844 oscuro y 320×740 claro. Se conservaron las pruebas de privacidad, movimiento reducido, ausencia de desbordamiento, revisión/cancelación/confirmación de estado y accesibilidad. Se añadieron precio 100 × cantidad 2 con subtotal publicado 170, total 175, valores ausentes, total contradictorio y cero explícito. Los tres recorridos aprobaron sin errores JavaScript; no hubo incidencias serias/críticas en las superficies de accesibilidad evaluadas.

El apiClient, API de seguimiento, normalizadores, componentes y controles de recibo son reales; sólo se sustituyen el transporte HTTP y contexto de prueba. Cada recorrido realiza una única escritura sintética de estado con el tenant y payload originales; consultar importes no produce escrituras. No se usan cuentas ni pedidos de clientes. Los tableros agregados y modos de portal tienen cobertura unitaria; no se afirma un recorrido autenticado productivo de esas pantallas.

Un primer envoltorio de ejecución no pudo imprimir ciertos caracteres del log en la consola Windows aunque el reporte del navegador había aprobado. La validación final guardó la salida en archivos y confirmó códigos de salida cero de cada proceso. Esa salida parcial no se utilizó como certificado de ejecución completa.

## Publicación

Se conserva el workflow existente `Order lifecycle and scoped operations`, ampliando sus filtros a los archivos monetarios y agregando reporte JSON de la suite al artifact. La publicación exige CI aprobado del SHA final, fuente limpia, candidato Production READY creado con `--skip-domain`, revisión HTML exacta y canaries públicos de sólo lectura antes y después de promover.

Los tres aliases productivos se actualizan de forma selectiva. `preview.chatboc.ar` debe permanecer en `dpl_ChY8GL3PJjnmCYH3qkWVsWg5HHeX`; la base `dpl_7w8wGzhKjibS7qyzHNffV1vSRery` se conserva para rollback. El resultado efectivo, revisión y deployment se registran en el PR y `.vercel/order-evidence/publication.json`; este documento no declara una publicación antes de comprobarla.

Evidencia local: `.vercel/order-evidence` y `.vercel/order-lifecycle-evidence`. La rama sigue la cadena publicada del Inbox; no mezcla otras ramas en main ni declara completados CRM, dominios propios, Analía/Conversa o la migración a Vercel + Neon.
