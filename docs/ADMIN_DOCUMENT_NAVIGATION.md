# Navegación administrativa sin excepciones escondidas en QA

Base frontend: 1e8b8104c79bc8a1391d0076c25167329f8f62d2, PR #1761.
En la aceptación fullstack anterior, tests/survey-workspace.browser.mjs del backend
sobrescribía el proxy /admin para poder abrir el documento SPA. La configuración
Vite normal no tenía ese comportamiento y devolvía JSON en esa navegación.
El test estaba validando una ruta de entrada diferente de la configuración normal.

## Corrección acotada

vite.config.ts añade sólo una importación y la propiedad bypass del proxy /admin.
adminDocumentNavigation separa GET/HEAD de documentos de las llamadas API.
Fetch Metadata debe ser coherente (document + navigate) y aceptar HTML. Sin
metadata se admite navegación HTML explícita para navegadores anteriores; una
solicitud JSON, AJAX, mixta o con metadatos contradictorios se conserva en backend.
POST/PUT/PATCH/DELETE/OPTIONS nunca reciben el documento estático por esta regla.
Login legacy, CSV/PDF/assets y /api mantienen su comportamiento. No se alteran
cabeceras de autorización, cookies, queries, cuerpos, roles o contratos de negocio.
Servir el shell público NO autoriza datos privados.

Se conservan ocho rewrites y toda la configuración de Vercel sin cambios. Este
corte corrige desarrollo/QA Vite, no demuestra una modificación de producción,
PWA instalada o despliegue de dominio. No cambia las bases, proveedores o planes.

## Evidencia

41 casos de Node sobre la función real pasaron localmente. El archivo Vite base
se reconstruyó desde el material disponible y se comprobó contra el blob exacto
38692b75b538afefff769d552bd1b976833ccb31 antes de aplicar las dos líneas.
La CI ejecuta los 41 casos, 16 escenarios HTTP con configuración Vite real y un
backend de transporte desechable, la suite frontend existente, tipos/build y
navegador de tarjetas. El backend de transporte permite verificar que403/401,
conflictos, métodos, cuerpos y cabeceras no se conviertan en HTML por accidente;
no es una aceptación de autenticación real.

La pareja fullstack debe fijarse al nuevo frontend y eliminar del harness el
bypass duplicado, conservando login, búsqueda, confirmación, mutación y lectura
posterior contra Flask/cuentas/SQLite desechables. Su resultado y SHA se registran
en ambos PR después de ejecutar; no se extrapola la aprobación de una pareja anterior.

Referencias de diseño consultadas: https://vite.dev/config/server-options
https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Sec-Fetch-Mode
https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Sec-Fetch-Dest
