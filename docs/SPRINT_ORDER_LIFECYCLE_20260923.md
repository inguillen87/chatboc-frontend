# Seguimiento de pedidos y operaciones verificadas

Base: `bd456e58654d3a2fae89b81c3faf78bc03994ed1` (PR #1769). Continúa los gráficos/CRM y la integridad del mapa sin sustituirlos, ni mezclar las ramas pendientes de encuestas/Tierra del Fuego.

## Alcance implementado

- Resumen reutilizable con señales separadas de pedido, pago y entrega. Confirmado, enviado, entregado y completado no demuestran pago. Un estado general paid se identifica como señal heredada, no verificación independiente. Estados mp_status explícitos y contradictorios se presentan para revisión, no como éxito.
- Detalle administrativo: sesión nueva por organización/ID, comprobación de identidad y estado del recibo, descarte de respuestas obsoletas, una sola mutación local pendiente y confirmación antes de cambiar estado. Cancelar la revisión no escribe. No se cambia la API compartida, los permisos ni el circuito asistido de resolución de artículos.
- Se elimina la búsqueda alternativa en todo el listado cuando falla el detalle. Denegaciones retiran datos; resultados inciertos bloquean nuevas mutaciones hasta una lectura explícita. Una lectura posterior no demuestra que la escritura incierta no ocurrió.
- Seguimiento público: respuesta correspondiente a la referencia, datos anteriores retirados en recarga/cambio, marca institucional suministrada por el servidor, estados independientes, productos e importes recibidos, actualización explícita y copia con manejo de error. Privacidad y redacciones prevalecen sobre contactos/coordenadas accidentales. No se infieren estados intermedios completados, rutas ni tiempos de llegada.
- Se elimina el enlace wa.me sin destinatario y la promesa de un representante online. Se conserva la apertura del chat existente con organización y referencia, sin afirmar que haya enviado o guardado un mensaje.
- Diseño adaptable, tema claro/oscuro y animación breve de entrada que respeta movimiento reducido. No hay personalizaciones de React por municipio/empresa.

## Validación y límites

Los archivos existentes modificados se cotejaron por SHA de blob con la base remota; el resto del árbol se conserva desde el commit indicado. Las comprobaciones locales ejecutaron 26 aserciones de lógica y transpilación sintáctica de 12 TS/TSX. No equivalen a Vitest, typecheck ni navegador.

Se incorporan regresiones de estados independientes, identidad, redacción, borrado tras denegación, respuestas tardías, StrictMode, doble llamada, confirmación y cancelación. El workflow dedicado ejecuta TypeScript, suite completa, build y Chromium en 1440/390/320 px, incluyendo tema oscuro, overflow, movimiento reducido, revisión/cancelación/guardado y axe. La evidencia declara datos y transporte sintéticos; no utiliza autenticación ni el backend productivo. El resultado final se registra en el PR por SHA, sin heredar cifras del sprint anterior.

El servidor sigue siendo autoridad de permisos. No se añadió control de concurrencia entre operadores, transacciones de pago, idempotencia o compare-and-swap al backend. El normalizador compartido de pedidos permanece sin cambios y requiere auditoría adicional de sus valores por defecto. No se certifica la entrega de mensajes, pagos, GPS, stock o logística reales.

La ficha administrativa exige la identidad canónica de la API (incluido el prefijo de origen). No transforma silenciosamente aliases de URL en IDs de otro origen. Recargar o navegar durante una mutación no la cancela en el servidor; el resultado tardío no cambia otra sesión.

Este lote no implica despliegue, cuentas productivas verificadas ni un CRM/marketplace completo. Vercel rechazó el scope del proyecto con 403 y el equipo remoto estaba desconectado durante su preparación. No se modifican dominios, credenciales, números ni datos de clientes.

## Continuidad priorizada y criterios de cierre

1. **Integración y publicación:** preservar ingreso SuperAdmin, verificar API real y permisos por organización, resolver acceso autorizado a Vercel, revisar candidatas y mantener URLs vigentes de los white labels. Un build correcto no constituye despliegue.
2. **CRM operativo:** oportunidades separadas de tickets, responsable, próxima acción, vencimiento y agenda persistentes. Migrar el pipeline legacy al circuito verificado; el gráfico debe abrir exactamente los registros que cuenta.
3. **Pedidos/marketplace:** estados independientes persistidos de compra/pago/preparación/entrega, transiciones autorizadas por backend, idempotencia, concurrencia, stock y recibos trazables. El circuito público no puede derivar pago de entrega ni de una preferencia de cobro.
4. **Reclamos:** historial real con autor/fecha/fundamento, responsable, derivación, reapertura y adjuntos según permisos. El seguimiento municipal no debe usar vocabulario ni promesas de reparto comercial.
5. **Encuestas y mapas de calor:** cerrar las ramas existentes antes de ampliar; denominador, filtros, cobertura y fecha de los datos visibles. Geografía agregada compatible con privacidad y sin coordenadas o encuestas de ejemplo presentadas como reales.
6. **White label:** misma plataforma compartida, identidad y módulos publicados por cada organización. Tierra del Fuego y Junín requieren pruebas de entrada, recarga/cierre de sesión, aislamiento de datos y sus canales autorizados; no crear números o credenciales sustitutos.

Ninguno de estos pendientes se considera terminado por documentarlo. Las nuevas pantallas de este corte son seguimiento de pedidos, no la migración de reclamos ni de encuestas.
