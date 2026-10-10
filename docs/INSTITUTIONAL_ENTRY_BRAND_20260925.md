# Ingreso institucional: marca pública verificada

Base: `f3cdce418820da4be1033facc16d64d6221e2d5b` (PR #1779). Este bloque preserva el acceso central e institucional ya publicado y no cambia cuentas, contraseñas, membresías ni el backend.

## Corregido
La normalización pública podía sustituir el slug recibido por el solicitado mientras conservaba el nombre y el logo del otro tenant. Se reprodujo esa aceptación con una prueba antes del cambio. Ahora los identificadores explícitos se validan antes de normalizar; una contradicción de slug o ID se rechaza y no se intenta ocultar mediante una segunda consulta por widget.
La respuesta normalizada incluye `publishedIdentity` sólo cuando el servidor aporta ID, slug y nombre coherentes. No se usa el slug solicitado, el nombre por defecto o un objeto de prueba enviado en el JSON como evidencia de identidad publicada. Los payloads legacy incompletos mantienen su compatibilidad anterior, pero no habilitan marca verificada.
Los slugs históricos con guion bajo se conservan exactamente. El flujo de resolución exclusivamente por widget no confunde el token con un slug esperado.

## Cambio visible
En la ruta institucional de login, el encabezado superior y el formulario utilizan el nombre y logo públicos verificados. Si no hay logo o su carga falla, se presenta un símbolo neutro, no una imagen inventada. El encabezado enlaza al espacio público de esa misma organización.
El login central, la portada, el SuperAdmin y los espacios privados conservan su marca y navegación actuales. No se cambia la identidad de una página sólo por una visita anterior o almacenamiento local. Durante carga, error o desajuste de la ruta se retira la identidad institucional anterior.
Los logos nuevos admiten HTTPS y rutas relativas a la raíz, sin credenciales o parámetros de firma en la URL. La imagen no transporta referrer. Los nombres con controles invisibles no se presentan como una marca válida. Los enlaces y el símbolo de fallback mantienen nombres accesibles y objetivos táctiles.

## Alcance
La modificación se limita al ingreso institucional y a la validación del contrato público. No crea dominios, SSO entre orígenes, organizaciones o usuarios. No activa la cuenta solicitada de Analía ni convierte la demo aislada de Conversa en una cuenta administrativa. No sustituye la migración Render→Vercel/Neon.
La herramienta rechazó el alta por el registro público y un resolver de marca privada propuesto. Esas operaciones no se completaron ni se reintentaron por otra vía. La implementación entregada es el contrato público y la presentación de la entrada, no aquel cambio de marca en el panel privado.

## Validación local
- TypeScript aprobado y **3421 pruebas en 422 archivos**, cero fallidas o pendientes: 41 pruebas nuevas respecto de la base publicada.
- Cinco pruebas HTTP/integradas del login aprobaron nuevamente contra las rutas originales de autenticación del backend `912446bf`, con cuentas y SQLite desechables; tres recorridos de navegador a 1440/390/320 validan la misma cuenta por ambas entradas, recarga y rechazo de otra organización. No se usaron credenciales productivas.
- Las pruebas del normalizador antes del cambio mostraron que aceptaba una respuesta de otra organización. Se mantuvieron las expectativas de rechazo después de corregirlo; no se modificaron los permisos de servidor.
- Las pruebas de navegación usan el `Link` real porque el mock global descartaba ref, nombre accesible y atributos del elemento. No se eliminaron los casos existentes del menú o del SuperAdmin.
- El fixture de identidad pública del recorrido de login sigue siendo sintético, pero ahora pasa su registro por el parser real. Esto no prueba DNS, certificados ni alta institucional.

El workflow existente `Unified organization login` se amplía con las rutas de código nuevas, sin duplicar innecesariamente pipelines. La compilación productiva, CI, canary de lectura y SHA publicados se documentan en el PR.
Los outputs y evidencias locales permanecen fuera de Git en `.vercel/institutional-brand-evidence` y `.vercel/unified-login-evidence`. Se reutilizó la dependencia existente sólo después de comprobar igualdad del package-lock; no se borraron archivos de clientes, configuraciones ni respaldos.
