# WL-BRAND-CONTINUITY — edición visual sin confirmaciones engañosas

Base frontend: 2fbf08a0f5dfe235cb7c350b5ed3de308fa601c8 (PR #1753).
Backend reutilizado: 8386769a81cd797af83b48e30ec90ea3969aaff5 (PR #2787).
No hay cambio de contrato, dependencia, migración ni autorización del servidor.

## Cambios funcionales

La paleta muestra si hay diferencias con la última lectura. Comparar contempla
activación, color principal y acento, con etiquetas textuales y muestras. El modal
presenta los valores exactos que se publicarán o la versión histórica elegida;
restaurar avisa que reemplazará también el borrador cuando el servidor confirme.

Descartar requiere confirmación y restaura únicamente el borrador local, sin PUT.
No se permite descartar ni publicar para eludir una publicación incierta: primero
se consulta y se elige explícitamente. Editar elimina la confirmación de éxito
anterior; una paleta idéntica o inválida no genera una publicación innecesaria.

La vista previa respeta el interruptor de activación. Desactivar conserva los
colores elegidos pero muestra una representación neutra, identificada como tal;
no pretende reproducir toda la apariencia predeterminada de cada superficie.
Los colores incompletos no producen contraste ficticio ni una muestra válida.

## Continuidad y límites

El aviso nativo beforeunload se registra sólo con cambios, una escritura pendiente
o un resultado que exige revisión. Se retira al confirmar, descartar, desmontar
o perder acceso. El borrador nunca se persiste en localStorage/sessionStorage.
No es un bloqueo de navegación interna del SPA ni recuperación duradera; tampoco
se garantiza la entrega del evento al cerrar una aplicación móvil o su proceso.
Referencia primaria: https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event

Se conservan scope por organización, generación contra respuestas tardías, revisión
esperada, recibo exacto, Full y permiso del backend. No se modifica nombre/logo,
menú, login, dominios, PWA, planes, usuarios, WhatsApp, números o callbacks.

## Verificación reproducible

- Vitest: OrganizationBrandContinuity.test.tsx (16 regresiones nuevas), las doce
  originales del estudio y diez del contrato, además de la suite completa.
- Types: npm run typecheck y npm run typecheck:scope. Build: npm run build.
- SPA real: desde backend, python -m tests.run_profile_browser --frontend RUTA.
  Usa create_app, sesiones y middleware originales sobre SQLite/cuentas sintéticas;
  no simula API/auth y no accede a clientes. Los recorridos de marca verifican
  aviso nativo de recarga cancelada, descarte, preview y confirmaciones a
  1440/820/390 oscuro/320, publicación/recarga y restauración. Evidencia en
  .vercel/profile-http-evidence. No equivale a un dispositivo físico o login QA.
- La CI frontend ejecuta la suite/tipos/build y los harnesses de perfil existentes.
  El recorrido cross-repo anterior es LOCAL; no se presenta como browser en CI.

Resultados concretos de cada ejecución, commit, CI y candidato se registran en
el PR sólo después de verificarlos; este listado describe alcance, no un aprobado.

## Cierre del candidato anterior

El 20/09/2026 se verificó el par anterior por HTML con revisión exacta, GET directo,
health/ready, GET a través del frontend, rechazo de /api/me anónimo y relecturas.
version_pair_verified=true; first_attempt_ready=false: hubo 503 de arranque antes
de responder 200. Eso no resuelve cold start ni autoriza la promoción.
No hubo escrituras remotas. Continúa el writer fence y la aceptación institucional.

## Evidencia local de este corte, 20/09/2026

Suite final: 3175 pruebas / 408 archivos. Typecheck y scope: aprobados.
Nueve recorridos SPA completos sobre backend real desechable: aprobados.
La confirmación respeta movimiento reducido; el recorrido espera opacidad final
y verifica por hit testing que el botón reciba interacción, no sólo su tamaño.
Se revisaron capturas de móvil y escritorio, incluyendo comparación y confirmación.
Dos ejecuciones interrumpidas no se contaron como aprobadas. La ejecución final
terminó con código 0 y liberó los contextos de navegador tras cada grupo de pruebas.

Resultados: docs/evidence/brand-continuity/local-spa.json y previous-preview-pair.json.
La aceptación institucional, el candidato de este commit y sus checks remotos
se registran por separado en el PR; no se deducen de estas pruebas locales.

## Corrección de revisión P1: textos controlados por el backend

La revisión de d6cd07c detectó vocabulario fijo en React incompatible con la política
white-label. Este corte sustituye ese candidato. Requiere backend PR #2788,
eee58b52024c86dee41e23e820e6fb1967778f5f, con workflow_ui versionado dentro de la
respuesta autenticada organization.branding.v1 y sus recibos de publicación.

Los 70 textos de estados, comparación, controles, preview, historial, confirmación
y resultado de publicación provienen ahora del servidor. Las personalizaciones
por organización se limitan a claves conocidas y texto plano de hasta 600 caracteres,
sin HTML ni controles, preservando variables obligatorias. Esa configuración no
sale en respuestas públicas. No existe todavía una pantalla para editar esos textos.
El cliente valida el contrato completo y no fabrica una paleta publicable si falta.
La UI usa texto escapado; comparar activación compara booleanos, no las traducciones.
El estado genérico de carga/fallo anterior al contrato permanece independiente.

La extensión es aditiva para clientes anteriores; el frontend corregido debe usar
el nuevo backend. No modifica almacenamiento de paleta, revisión, roles, Full,
auditoría, bootstrap, migraciones o acciones de proveedores.

Validación de la corrección: 3183 pruebas frontend en 409 archivos, TypeScript,
scope y nueve recorridos SPA reales aprobados sobre este backend desechable.
Se agregaron ocho regresiones de contrato/renderizado a las 16 de continuidad.
Backend focal: 21 pruebas locales aprobadas y una carrera PostgreSQL omitida en
SQLite; ocho pruebas nuevas de vocabulario. La CI PostgreSQL existente incluye
el módulo nuevo y verifica su propia carrera real. No se deduce su éxito localmente.

El candidato previo 6phrr6ns6 / d6cd07c queda como evidencia histórica, no como
entrega corregida. El nuevo par inmutable, sus checks de CI y la lectura remota se
registran en el PR después de observarlos. No se promovió producción ni alias QA.
