# Administración explícita de la guía institucional

Base frontend: `a56584748b8e932a7ae03cfcbee6654aa318b746` (#1797). Par backend: PR #2803, rama `feat/private-guide-control-20260929`. Este incremento no publica código ni habilita una organización por sí mismo.

## Recorrido completo implementado

El Centro de Implementación muestra el panel únicamente cuando la lectura vigente de activación publica `conversation_guide_control`, coincide en identidad y mantiene una sesión verificada. No deduce administración desde el correo, nombre, plan, rol local o un descriptor antiguo del perfil. Todos los textos y acciones visibles vienen del backend.

Abrir el panel consulta el estado y la guía instalada sin escribir. Habilitar o deshabilitar requiere una revisión y un reconocimiento explícito de evaluación. Confirmar realiza una lectura previa; debe coincidir con la revisión y, al habilitar, con la guía/fuente que el operador revisó. Un cambio exige volver a leer y revisar, no adoptar silenciosamente otra versión.

Después se envía un único PUT con identidad, revisión, reconocimiento y hashes esperados para habilitar. Deshabilitar permanece disponible aunque el archivo haya sido retirado, cuando el servidor lo permite. No admite URLs arbitrarias, efectos operativos o permisos inventados.

El recibo debe confirmar organización, estado, guía, versión siguiente y revisión nueva. Una lectura posterior debe coincidir antes de anunciar éxito y actualizar el contrato de activación del lector. Una respuesta incierta o un fallo retiran los datos y exigen consulta explícita; no hay reintento automático ni una segunda escritura por clic repetido.

Cambiar de sesión o retirar el descriptor desmonta el panel: una lectura previa tardía no puede iniciar un PUT y un recibo atrasado no actualiza el espacio nuevo. Si una petición de escritura ya salió, desmontar no la deshace; la revisión atómica del backend resuelve la concurrencia.

El panel conserva interfaz nativa, etiquetas de backend, controles de 44 px, confirmación accesible, foco visible, modo oscuro y diseño móvil. No modifica fuentes, documentos de TDF, cuentas, contraseñas, números, casos o proveedores.

## Validación local

TypeScript y 45 pruebas focalizadas aprobaron (37 casos nuevos más ocho regresiones del lector). El navegador utiliza el checklist, panel y parsers reales con HTTP/sesión sintéticos a 1440×1000 claro, 390×844 oscuro y 320×740. Cada recorrido ejecuta una modificación sintética confirmada y un intento denegado, revisa cancelación sin escritura, doble clic, lectura de confirmación, retirada durante lectura previa y errores sin datos privados. No es una prueba con la cuenta de Analía ni la base productiva.

Los tres recorridos aprobaron sin errores JavaScript/desbordamiento; axe no encontró incidencias serias/críticas en el panel evaluado. Se revisó la captura móvil oscura. El optimizador del fixture se limitó a su entrada HTML: al buscar otras entradas de prueba con adaptadores diferentes informaba imports no utilizados por este recorrido. No se excluyeron módulos del build de producto ni se redujo la regresión completa.

La corrida focal inicial con sólo reporter JSON devolvió código 1 y cero pruebas, aunque su JSON contenía success=true; no se consideró una validación. Se repitió con reporter de texto, verificación de salida y recuento no nulo. La última corrida aprobó todos los 45 casos. No se limpiaron archivos del usuario ni se ejecutó una compilación completa concurrente en el equipo con poco espacio; los workflows de acceso institucional y arranque certifican la revisión final en runners limpios.

## Pendientes operativos separados

El backend publica el descriptor sólo a su SuperAdmin autorizado. El panel no permite autoaprobar la guía desde una cuenta institucional. El servicio exige origen web confiable, encabezado explícito, JSON limitado y revisión bajo bloqueo, con auditoría atómica. Esas reglas son autoridad del servidor, no de React.

La organización Tierra del Fuego ID 46 y su alta nominal existen según las verificaciones anteriores. Este cambio no vuelve a crearlas y no usa la credencial protegida cuyo ensayo fue bloqueado. La entrega segura y autenticación real de Analía continúan pendientes. La guía sigue siendo evaluación con fuentes sujetas a aceptación, no RAG operativo ni trámite real.

Para utilizar el panel hacen falta backend y frontend compatibles desplegados, acceso autorizado a infraestructura, configuración explícita por el SuperAdmin y verificación del espacio real. No se ejecuta un despliegue mediante merge como sustituto del acceso denegado a Vercel. MuniControl permanece fuera de alcance.

## Revisión P1: transporte sin repetición

La revisión detectó que apiFetch podía repetir un PUT rechazado por la red contra otro candidato de API o ruta. El bloqueo del componente no evita una repetición interna del transporte. Se agregó la opción explícita singleAttempt, deshabilitada por defecto para no alterar otros consumidores. El control la exige en GET/PUT: usa un solo destino elegido, sin candidatos/rutas alternativos ni seguimiento de redirecciones. Se mantienen las cabeceras de autenticación, ámbito, caché y comprobación de preparación previas al envío.

Siete pruebas del transporte real reproducen pérdida de respuesta, códigos HTTP, HTML de proxy y conservación de las cabeceras; cinco fallaban sobre la implementación anterior. Las pruebas de fallback preexistentes permanecen vigentes para quienes no solicitan singleAttempt. El navegador usa transporte sintético; la ausencia de repetición dentro de apiFetch se acredita específicamente con esa regresión real, no con un mock que omita el fallback.

La revisión anterior y sus CI no certifican esta corrección posterior. Debe repetirse la suite completa para el SHA final antes de cerrar la validación; ningún candidato se publicó entre ambas revisiones.
