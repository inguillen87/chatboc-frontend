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

La configuración de Vercel no se modifica. Este corte corrige desarrollo/QA Vite,
no demuestra una modificación de producción, PWA instalada o despliegue de dominio.
No cambia las bases, proveedores o planes.

## Evidencia y corrección del test de preflight

41 casos de Node sobre la función real pasaron localmente y en el primer run
frontend35785034424. El archivo Vite base se comprobó contra el blob exacto
38692b75b538afefff769d552bd1b976833ccb31 antes de aplicar las dos líneas.
El paso de tipos del primer run también pasó, pero el paso HTTP falló porque
esperaba401 del backend para OPTIONS, que el middleware CORS previo de Vite
responde con204. Ese fallo del test impidió ejecutar la suite/build en ese job;
no se presenta la ejecución entera como aprobada.

Se corrigió la expectativa de OPTIONS sin desactivar ni modificar CORS o el proxy:
comprueba204, cuerpo vacío, cabeceras de preflight y cero solicitudes al backend.
El resto mantiene sus aserciones de401, conflicto409, cuerpos y cabeceras. Un
preflight no es autorización de acceso ni una respuesta HTML del panel.

La CI del head corregido ejecuta41 casos Node,16 escenarios HTTP con configuración
Vite real y un backend de transporte desechable, la suite frontend existente,
tipos/build y navegador de tarjetas. El fixture HTTP no equivale a autenticación real.
La pareja fullstack debe fijarse al frontend final y eliminar del harness el bypass
duplicado, conservando login, búsqueda, confirmación, mutación y lectura posterior
contra Flask/cuentas/SQLite desechables. Registrar resultados por SHA en ambos PR;
no atribuir los resultados de una pareja anterior a una posterior.

Referencias: https://vite.dev/config/server-options
https://github.com/expressjs/cors/blob/master/lib/index.js
https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Sec-Fetch-Mode
https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Sec-Fetch-Dest
