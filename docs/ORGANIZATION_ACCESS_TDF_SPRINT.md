# Acceso e identidad institucional compartidos — 23 septiembre 2026

## Resultado y alcance

Tierra del Fuego debe ser una organización de ChatBoc: entrada común en
`chatboc.ar/login`, cuenta nominal vinculada por el servidor, marca institucional
y módulos existentes dentro del mismo producto. Un alias de Faro o Conversa no
resuelve la identidad SaaS. Este sprint implementa y valida ese flujo con cuentas
locales descartables; no certifica ni crea la cuenta productiva solicitada.

Rama coordinada: `feat/organization-access-20260923`, sobre el sprint de comparación
de encuestas `2ac4e8a7` backend / `d871772d` frontend (PR 2798 / 1764). Se conserva
el trabajo anterior y no se modifica el checkout original de OneDrive.

## Cambios reales

- El ingreso global no hereda el tenant de una visita pública anterior. El acceso
  `/t/:slug/login` envía el slug completo. La nueva identidad reemplaza la anterior
  y el token vigente queda sincronizado con el almacén de sesión.
- El encabezado administrativo muestra nombre, tipo y logo que vienen del perfil
  autenticado. Los dos contratos deben coincidir en organización; una recarga
  vuelve a verificar el perfil. Las páginas públicas conservan su marca habitual.
- El paso de conocimiento de `/implementacion` descubre una guía privada sólo
  cuando el servidor la habilita y el actor puede administrar esa organización.
  La lectura es diferida hasta abrirla y reutiliza el renderer de Agente Conversa.
- Se recuperan exactamente los 29 nodos del MVP, con su huella y referencias de
  página. La guía sigue siendo evaluación: no es RAG productivo, no recibe datos
  personales ni crea casos, respuestas de encuesta o mensajes de WhatsApp.
- El alta de organizaciones rechaza trasladar una cuenta con vínculos a otro
  tenant. Una contraseña omitida no cambia la existente. Los fallos revierten la
  transacción; se mantienen las altas nuevas y el caso legacy realmente libre.

Los módulos operativos de encuestas, reclamos, pedidos, atención, analítica y equipo
siguen dependiendo de la navegación y permisos del backend. Elegir funciones en
el preparador no equivale a habilitarlas ni a conectar un proveedor. No se agregan
permisos por correo, por URL ni por el nombre de una institución.

## Fuentes y continuidad del cliente

Se revisaron el presupuesto formal v2 de 12 páginas y el plan de IA accesible y
Mesa Única de 14 páginas suministrados por el cliente. El alcance inicial del
documento es discapacidad en Ushuaia, Río Grande y Tolhuin, con cinco áreas de
atención y cierre de satisfacción. El requerimiento nuevo reutiliza los módulos
de ChatBoc para ese espacio, sin convertir el presupuesto en una autorización de
integraciones oficiales o de tratamiento de expedientes sensibles.

La guía procede del commit `f64a11aedfc076589e1924a16ecf31e6b03702f6` y mantiene
SHA-256 `f028f657752ecc74c9cb1d7f4ae8408d210f42a9b0d8ccb6a9afc7bf83d4bf41`.
Su documento de origen conserva SHA-256
`1f6de63d4f70ede4e967077cc9eae768c64574b022d66c5ebb8868aac3d4a6ee`.
La aprobación y vigencia del contenido operativo siguen pendientes.
No se subieron los PDFs al catálogo público; la descarga legacy de ese catálogo
no acredita una biblioteca documental privada.

## Estado publicado verificado al inicio del sprint

- `https://agente-conversa.vercel.app/`: evaluación autenticada existente, SHA
  `39f957900540e33d6f66123534f5f19eb84ae03d`, no CRM productivo ni WhatsApp conectado.
  El período informado vence el 2 de octubre de 2026 a las 23:10:26 ART.
- `https://faro-tdf.vercel.app/`: presentación institucional existente.
- `api.chatboc.ar`: backend servido `912446bf`, Render/Gunicorn. No contiene aún
  los blueprints/readiness del checkout de este sprint. La consulta de Neon no
  sustituye la verificación de la base que sirve ese backend.
- No se pudo certificar que `analia@tdf.com` exista o esté vinculada en producción.
  No se creó ni trasladó una cuenta, no se cambió una contraseña y no se enviaron
  invitaciones o mensajes. El número de WhatsApp lo aportará el usuario después.

## Validación

El recorrido de aceptación usa la SPA y Flask originales, login real, SQLite
descartable y redes externas bloqueadas. Cubre ingreso global con contexto viejo,
login canónico, recarga, nombre institucional verificado, lectura diferida y
navegación de la guía, rechazo de tenant ajeno y scope contradictorio, WhatsApp
pendiente, teclado y ausencia de desbordes a 1440/820/390 oscuro/320 px. No cambia
organizaciones, propietarios, contraseñas, tickets ni respuestas de encuestas.

Resultados finales locales:

- Frontend: 3.551 pruebas aprobadas, cero fallos, 438 archivos; typecheck general
  y estricto de scope aprobados; build y guard de rutas aprobados.
- Backend: 59 regresiones y 34 subtests aprobados mediante
  `python -m tests.organization_access_regression`; 13 pruebas HTTP de guía
  aprobadas mediante `python -m tests.private_conversation_guide_http`.
- Autenticación Clerk: 76 regresiones aprobadas y 10 de onboarding repetidas
  después del último endurecimiento de vínculos de propietario.
- Recorrido compartido: `python -m tests.run_organization_access_browser
  --frontend <checkout-frontend>` aprobado en los cuatro anchos. Incluye cerrar
  sesión, entrar con otra organización y comprobar que no recibe la guía anterior.
- MVP aislado: 15 pruebas Node y los cuatro recorridos HTTPS locales originales
  aprobados, con navegación por número, derivación/cierre simulados, recarga,
  salida y exportación de 29 mensajes; sigue rechazando la descarga sin sesión.

Las capturas se revisaron en escritorio y móvil. La primera ejecución de la suite
detectó un mock que daba la respuesta A también a la nueva consulta B; el test
ahora usa dos respuestas independientes y ambos órdenes de llegada. No se relajó
la protección del producto. El recorrido usa datos sintéticos y nunca la cuenta
de Analía. La aceptación local no implica activación remota.

Se extendió el flujo de CI existente para estos archivos y sus pruebas; no se
añadieron despliegues manuales. La preview Git del sprint anterior fue CANCELED
(`dpl_3kwtRE2TXXj3NUhc7KYz4aSBZw2t`), pese a la señal verde de GitHub; no es una
publicación válida ni un backend emparejado, pues sus rewrites apuntan a producción.

## Siguiente corte

1. Reconciliar el lote apilado con el backend y base realmente productivos y
   verificar el despliegue coordinado antes de provisionar una identidad real.
2. Confirmar/reutilizar la organización TDF y su cuenta nominal por la vía
   administrativa soportada, conservando cuentas existentes y entregando acceso
   seguro. No se emplearán las credenciales de evaluación como identidad SaaS.
3. Aplicar marca y habilitaciones acordadas; probar ingreso desde ChatBoc y
   recorridos reales de encuestas, pedidos/reclamos y atención en ese tenant.
4. Añadir biblioteca privada con fuentes, responsables, revisión y vigencia,
   conectada al motor real de conocimiento; no habilitar los stubs de RAG.
5. Con el número aportado, verificar WhatsApp de ese tenant y recién después
   probar envíos autorizados, recepción y derivación humana trazable.

No se requiere un nuevo producto ni otra aplicación exclusiva para TDF.
