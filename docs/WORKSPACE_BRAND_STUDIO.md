# WL-BRAND-PALETTE: estudio visual con publicación verificable

Base frontend c90f73e / backend 86104a1c. Se incorpora al perfil institucional en
Identidad visual: no se crea otro panel o aplicación por cada cliente.

## Experiencia

Selector de colores principal/acento, presets enviados por el servidor, vista
móvil/escritorio y claro/oscuro. La muestra presenta nombre/logo institucionales,
no el avatar personal del operador. Las acciones de muestra no envían mensajes.
El cambio de preview no publica ni modifica los estilos globales de la página.
La paleta sólo se publica después de confirmación y recibo validado del servidor.

La UI distingue consulta, Full requerido, mantenimiento y permiso insuficiente.
El frontend no concede Full ni decide la autorización; respeta el contrato del
servidor. Los aliases comerciales se documentan en el backend. No se certifica
que exista una factura cobrada por tener un nombre de plan en el registro.

Una lectura y escritura concurrentes no se duplican; el resultado tiene tenant,
versión y valores verificables. Timeout o respuesta dudosa conserva borrador y
pide consultar de nuevo. La consulta muestra ambas paletas; elegir no publica.
No se almacena borrador en localStorage ni se promete cancelar una transacción
remota cuando vence la espera del navegador. Las respuestas tardías no cruzan
organizaciones. Se conservan hasta diez versiones anteriores para restauración.

## Integración y pruebas

El contrato workspace_appearance modifica únicamente el encabezado del perfil y
el encabezado del centro de implementación mediante CSS local. Se revalida el scope
y se descarta al cambiar de organización; no se inyecta una paleta en todo el DOM.
El mapeo del perfil fue corregido después de reproducir la pérdida de color al recargar.
Las etiquetas de rol y versión usan el foreground legible calculado para esa paleta.
Las superficies externas, menú general, portal público, dominios, PWA y WhatsApp no
se presentan como cubiertos en este corte. El logo usa su guardado institucional previo.

Fixtures de contrato producidos por el builder Python. Regresiones de publicación,
restauración, plan, scope, revocación, concurrencia de interfaz y tiempo de espera.
La SPA completa contra el backend real prueba el circuito de publicación/recarga y
restauración con datos y cuentas sintéticas, sin mocks de API o autorización. Las
capturas cubren 1440, 820, 390 oscuro y 320; no equivalen a dispositivos físicos.
El renderer respeta movimiento reducido y el color no es la única señal de estado.
La relación de contraste mostrada se limita al texto de las muestras, no al sitio.

Estado de CI y par Preview se registra en el PR después de comprobar cada revisión.
No se promueve producción ni se modifica el acceso de evaluación de TDF o Junín.
Las cuentas, planes comerciales reales, números y callbacks quedan intactos.
Referencia de contraste: https://www.w3.org/TR/WCAG22/#contrast-minimum .
