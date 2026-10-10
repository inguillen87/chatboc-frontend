# Acceso central e institucional — cierre de integración

## Base y alcance
Se parte del frontend publicado `bff447712cf1beb6ae8419588aedbc1d1eb6d759`, sin reemplazar sus mejoras de Encuestas o del SuperAdmin. Se integró únicamente el subconjunto de autenticación del PR #1765 (`714f8811`), más validación de respuestas, aislamiento del formulario y pruebas. No se incorporaron las ramas de guías privadas, tareas, encuestas A/B ni la migración de infraestructura.
El endpoint existente `/auth/admin/login` sigue siendo la única autoridad de credenciales. No se modifica backend, contraseña, rol, membresía o cuenta productiva.

## Problemas corregidos
El acceso central heredaba el tenant de navegación/localStorage. Una ruta `/t/<organizacion>/login` podía interpretar `t` como organización. Además, la persistencia de la nueva sesión fusionaba datos de la cuenta anterior con los recién recibidos.
Ahora `/login` envía la solicitud sin tenant anterior, bearer anterior, token de widget, sesión de chat o cookies. Una entrada institucional usa sólo su slug explícito; no modifica almacenamiento antes de recibir una respuesta válida. El servidor sigue autenticando la cuenta y derivando su organización, no concediendo pertenencia por la URL.
La respuesta debe incluir token no vacío, ID, correo de la cuenta solicitada, rol administrativo conocido y organización coherente. Se rechazan aliases contradictorios y el resultado de otra organización en una entrada institucional. No se instala esa sesión ni se cambia la cuenta anterior.
Al completar un acceso válido se reemplaza la identidad, se sincroniza el store del panel y se retiran datos institucionales/privilegios heredados y el token de entidad anterior cuando no se entrega uno nuevo. La consulta `/api/me` se verifica por sesión y revisión para evitar que una respuesta antigua actualice otra cuenta.
El formulario bloquea envíos simultáneos y no persiste respuestas de una pantalla abandonada o de una sesión sustituida durante la espera. Los errores del servidor no borran automáticamente la sesión previa. La redirección de regreso no envía a otro tenant mediante el parámetro `next`.

## Interfaz y compatibilidad
La entrada institucional muestra el nombre sólo cuando la identidad pública corresponde al slug solicitado. Incluye un enlace al acceso central, sin transferir credenciales entre URLs. Correo/contraseña tienen etiquetas accesibles y los errores se anuncian mediante un alert. Se corrigió el contraste del botón de ingreso y el comportamiento con movimiento reducido.
Una comprobación read-only del esquema vigente encontró dos identificadores históricos con guion bajo (`local_comercial_general` y `medico_general`). Se conserva ese formato exactamente en el acceso, sin convertirlo a otro slug. No se renombraron organizaciones ni se cambió la resolución de dominios del resto de la plataforma.

## Qué no hace este cambio
No registra dominios, no verifica DNS/propiedad/certificados, no crea usuarios ni replica sesiones mediante cookies entre dominios diferentes. La misma cuenta puede autenticarse contra la misma API desde el ingreso general y una ruta institucional compatible; eso no implica SSO automático entre orígenes.
La demo separada de Conversa no se convierte en una cuenta administrativa. La consulta del usuario solicitado devolvió cero coincidencias en la base productiva; la provisión institucional de Analía continúa siendo necesaria. No se probaron ni almacenaron las credenciales reales compartidas por el solicitante en este lote.

## Validación ejecutada
Suite completa local: **3380 pruebas en 419 archivos**, cero fallidas o pendientes; 37 casos adicionales sobre la base publicada de 3343. TypeScript aprobado. Se conservaron las pruebas de perfil, sesión y respuestas fuera de orden del proyecto y del parche original.
**5 pruebas HTTP/integradas aprobadas** sobre las rutas originales de autenticación de la API observada y SQLite desechable. El runner verifica que `routes/auth.py` coincide con la revisión productiva antes de arrancar el entorno; no carga archivos .env y bloquea red externa desde el backend de pruebas.
La prueba integrada ejecuta la página Login real en Chromium a 1440×1050, 390×844 oscuro y 320×740. En cada recorrido: entrada central sin contexto anterior, entrada institucional con la misma cuenta, consulta autenticada de perfil, recarga y rechazo de una ruta de otra organización sin instalar esa sesión. Se utilizaron cuentas generadas únicamente en la base desechable. El transporte de navegador y los proveedores opcionales de identidad/demo son adapters de prueba; no se acreditan Google, Clerk, passkeys o cuentas productivas reales.
Axe detectó un contraste insuficiente en el botón de ingreso; se corrigió el contraste en lugar de omitir la comprobación. El entorno de navegador también se ajustó para deduplicar React al utilizar las dependencias enlazadas entre worktrees. Los tres recorridos finales aprobaron sin errores JavaScript ni desbordamiento y sin infracciones serias/críticas en el formulario.
Las pruebas suplementarias de redirección/ciclo de vida y un servidor sintético adicional rechazados por la herramienta no se incorporaron por otra vía; los conteos corresponden sólo a los casos efectivamente ejecutados. El workflow nuevo ejecuta tipos, regresión completa y build; el ensayo con Flask y navegador se ejecutó localmente, no dentro de ese job.

## Reproducción y publicación
`npm run typecheck`; `npm test -- --maxWorkers=4`.
`python tests/unified_login_http.py --backend <checkout-con-fixture-de-aceptación> --browser`.
El cambio se publica con una revisión explícita, build Production sin mover los dominios primero, comprobaciones del candidato y control de avance concurrente antes de asignar alias. No se cambia el esquema, backend, DNS de empresas, WhatsApp o proveedores externos de identidad. El PR registra SHA, CI, deployment y verificación final.
Las demos comerciales se conservan en el acceso central y no se muestran dentro de la entrada institucional. La cuenta institucional real de Analía y el alta/verificación de su dominio propio siguen pendientes; la corrección del formulario no se presenta como esa provisión.
