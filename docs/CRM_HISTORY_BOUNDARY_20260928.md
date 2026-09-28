# CRM: historial ligado a la ficha y a su lectura vigente

Base productiva: `f13a671fb1c51fc5103dae5cb2fe6f1444a98f8c`, PR #1792.
Alcance: historial multicanal y casos exactos consumidos por Personas 360.

## Problemas reproducidos

La normalización anterior asignaba al resultado el contactId seleccionado sin contrastarlo con `contact.id` recibido. También conservaba los datos de una consulta previa cuando una recarga fallaba, tanto en la vista derivada como en el resultado imperativo de refetch. Deshabilitar el detalle no impedía que una referencia previa invocara manualmente refetch. Las nuevas regresiones fallaron sobre esa implementación antes de cambiarla.

## Corrección

- Se exige un sobre estructuralmente válido con `contact.id` coincidente e interacciones como lista de objetos. Si se publican aliases de contacto u organización, deben coincidir también; se cotejan en el sobre, contacto e interacciones.
- No se exige un slug adicional a un contrato que no lo publica: la ruta autenticada y el servidor siguen siendo autoridad de tenant. No se inventa esa evidencia de servidor ni se usa una etiqueta de presentación como identidad.
- Cada ficha montada tiene su propia clave de consulta junto con organización y contacto. No hereda la respuesta fresca del montaje anterior. Se elimina su consulta al desmontar; al deshabilitar puede subsistir un observador vacío, pero no su contenido anterior.
- Al comenzar una lectura se retira el contenido anterior, también del caché. Si falla, la ficha y el resultado de refetch no devuelven eventos ni enlaces anteriores. La recuperación exige una nueva respuesta válida.
- Los cambios de contacto/organización, la deshabilitación y el desmontaje retiran resultados pendientes. Refetch comprueba el contexto antes y después de la lectura. Un callback antiguo no reactiva una ficha deshabilitada.
- Se conserva la validación existente de `crm.contact_cases.v1`, identidades source_model/ticket_id y enlaces internos reconstruidos. El botón de casos existente puede volver a intentar consultar, pero no navega utilizando el recibo previo rechazado.
- Los errores de transporte no pasan con su texto libre al estado de presentación. Se utiliza el mensaje neutral ya existente. No se agrega copy de negocio, una nueva pantalla ni botones inferidos del backend.

## Contraste con el servidor

Se leyó `routes/crm/routes.py` en el backend `912446bf96f8330664a9dec009ae57dbf935c73c`, sin modificarlo. La ruta de historial recibe tenant/contacto, autoriza al operador y devuelve `contact.id` e `interactions`. Las pruebas antiguas de éxito se ajustaron para incluir esa identidad publicada, no para fabricar nuevas capacidades.

El transporte compartido no expone AbortSignal. La cancelación retira la consulta y descarta su resultado; no implica que el GET haya dejado de ejecutarse en la red ni que el servidor haya cancelado trabajo. Se mantiene su firma y no se modifica el cliente API global.

## Verificación

Las 19 regresiones iniciales fallaron sobre la implementación anterior. La cobertura ampliada incluye rechazo de identidades cruzadas, denegaciones 401/403/404, errores 500, respuesta malformada, recuperación, lectura pendiente, cambio de tenant, deshabilitación, callback antiguo, desmontaje y StrictMode.

Las expectativas del transporte conservan la firma original. Las aserciones de estado renderizado esperan la notificación del observador de React Query; el resultado imperativo se comprueba directamente. Una ficha deshabilitada puede mantener una entrada de consulta vacía, pero la regresión exige que no conserve datos anteriores. No se aumentan timeouts ni se aceptan recibos de otra identidad.

El recorrido Chromium usa Personas 360, su hook, normalizadores e identidades de caso reales, con transporte y datos sintéticos. Comprueba retiro de enlaces tras denegación, intento de abrir sin resultado válido, rechazo de contacto/tenant ajenos, respuesta malformada, recuperación, cambio de contacto con respuesta demorada y cambio de organización. Los cambios de identidad del componente se ejercitan desde el contenedor de la prueba; no se presentan como una autenticación real.

Se mantiene la regresión previa de seguimiento comercial y el presupuesto de arranque del sprint anterior. El workflow existente CRM persistent follow-up incorpora el recorrido de historial y cubre todos los archivos del módulo de personas. El workflow Application startup performance se ejecuta también por el cambio en src, sin modificar ni ampliar sus límites.

## Límites y publicación

No se implementa una bitácora global de auditoría, eventos adicionales, tareas, notificaciones ni una nueva fuente de permisos. Tampoco se cambian endpoints, backend, escrituras de CRM, clientes API globales, cuentas, pagos o MuniControl. La protección descrita se aplica a la consulta de historial de esta ficha; no se atribuye a todas las sesiones o cachés de la plataforma.

La revisión debe aprobar ambos workflows, sus artifacts y el candidato Production con revisión exacta. La promoción selectiva preserva Preview `dpl_ChY8GL3PJjnmCYH3qkWVsWg5HHeX` y la base `dpl_6h2152Ngy9nnjxQeLuy1Wq6Fw6Lo` como rollback. La verificación pública posterior se limita a ingresos, recursos y rechazo anónimo administrativo; no utiliza cuentas ni contactos de clientes.

El resultado efectivo se registra por SHA en el PR y `.vercel/history-evidence/publication.json`. Los reportes de pruebas y capturas declaran transporte y datos sintéticos; no certifican permisos productivos de cada cuenta, comportamiento de todos los módulos, ni cancelación HTTP en el servidor.

## Resultado local previo al commit

TypeScript, **3766 pruebas en 443 archivos**, compilación, tres recorridos nuevos de historial, tres recorridos existentes de seguimiento y auditoría de presupuesto de arranque aprobaron. Son **26 pruebas adicionales** respecto de la base, sin pruebas fallidas ni pendientes. La revisión final debe reproducir esos resultados en CI; este corte no reutiliza cifras de otro SHA.

El grupo focalizado aprobó 79 pruebas. Los tres tamaños de navegador (1440×1000 claro, 390×844 oscuro y 320×740 claro) confirmaron los rechazos y recuperación sin escrituras, errores JavaScript ni desbordamiento horizontal. La sección de casos evaluada por axe no presentó incidencias serias/críticas; se revisó visualmente la captura móvil oscura. No se afirma una auditoría de accesibilidad completa de la aplicación.
