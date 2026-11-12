# Integracion de CRM y pedidos - 2026-09-23

## Base preservada
- Produccion observada: `662698487637087c5d71e5cb44a9b19031466adb`, deployment `dpl_ChY8GL3PJjnmCYH3qkWVsWg5HHeX`.
- Esta entrega desciende de esa revision y de `39f1a9f4c6fdf64dc3da9d3aa5284b9914d6b3e1` (PR 1770).
- Incluye la continuidad de CRM por organizacion, notas/etapas verificadas, graficos, tablero y estados separados de pedido/pago/entrega de los PR 1768-1770.
- No integra ni sobrescribe las ramas paralelas de encuestas, Tierra del Fuego o la release 1762.

## Correcciones de integracion
- Las lecturas y escrituras administrativas validan el recibo HTTP original antes del normalizador. Una respuesta sin ID/estado no puede convertirse en una confirmacion por valores por defecto.
- Se comprueba ID canonico, organizacion cuando es explicita y estado solicitado antes de aceptar una mutacion.
- Estados y fechas ausentes dejan de inventarse como `nuevo` y fecha actual. Se mantienen vacios para los consumidores existentes.
- El modelo `commercialInsightsModel.ts` se distingue del componente `CommercialInsights.tsx`: evita la resolucion ambigua de TypeScript en Windows.
- Se agregan 17 regresiones de la frontera API sin eliminar las pruebas existentes.

## Evidencia local
- Entorno: Windows, Node 24.15.0, dependencias del package-lock.
- TypeScript: aprobado.
- Suite completa: 3072 pruebas aprobadas en 398 archivos; reportes en `.vercel/crm-release-evidence/`.
- Chromium: CRM y pedidos, cada uno en 1440x1000, 390x844 oscuro y 320x740; seis recorridos aprobados.
- Se mantienen las comprobaciones de overflow, movimiento reducido, cancelacion sin escritura, una escritura por confirmacion y ausencia de infracciones serias/criticas en los alcances axe evaluados.
- Capturas revisadas: CRM escritorio y seguimiento de pedido movil oscuro.
- Los recorridos utilizan datos/transporte sinteticos. No certifican pagos, entregas, permisos productivos ni autenticacion de usuarios reales.

## Publicacion
La promocion requiere build de produccion, verificador de revision/rutas, deployment sin mover dominios, comprobaciones HTTP y confirmar que produccion no haya avanzado concurrentemente. El resultado final y los identificadores se registran en el PR.
No se modifican bases de datos, canales, numeros, dominios ni permisos. Las protecciones de preview hacia el backend productivo permanecen activas.
