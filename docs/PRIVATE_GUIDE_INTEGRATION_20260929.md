# Guía institucional privada: integración en Chatboc actual

Base: `2f2fc5fb53bdc37f276d5dfc03f56453e8ebed78` (carrito #1796; pendiente de despliegue).
Esta entrega no es un alta de usuario ni una publicación de la versión TDF completa.

## Integración

El Centro de Implementación conecta la guía al contrato ya documentado del backend #2799: `channel_activation.organization_setup.conversation_guide`. La entrada aparece únicamente tras una lectura actual de activación, con organización/ID coherentes y cuenta verificada por el contexto existente. El perfil inicial, nombre, correo, plan o URL no habilitan una guía por sí solos.

Abrir el control solicita un nodo al endpoint privado del mismo tenant. El contenido, etiquetas, opciones, referencias de página y estado de aprobación vienen del servidor. No se copian los documentos de Tierra del Fuego, sus 29 menús o claves al bundle público; las pruebas nuevas contienen exclusivamente textos sintéticos.

El lector utiliza la misma ruta y parámetros `node`/`selection` del contrato original. Comprueba la identidad, política de evaluación sin escrituras/proveedores, nodo esperado y referencias válidas. No mezcla versiones de la guía o su fuente durante un recorrido. Las huellas se validan como referencias declaradas por el servidor, no como una firma digital ni como un hash recomputado del PDF completo.

Al cerrar, cambiar de cuenta/organización, perder la verificación de sesión o retirar el descriptor, se desmonta el contenido. Las respuestas demoradas se descartan. El resultado anterior no permanece visible mientras se consulta otro nodo. La navegación es por opciones publicadas, no un agente de IA, RAG, registro de casos ni envío a WhatsApp.

El lector no guarda contenido en localStorage/sessionStorage. Solicita no-store mediante la API existente. El servicio conserva su autoridad real de permisos: una declaración de política en JSON no sustituye la autorización del endpoint. No se cambian roles, cuentas, sesiones, transportes ni las reglas de PWA.

## Experiencia de uso

Control nativo desplegable, foco en el nodo recibido, opciones táctiles, distribución adaptable, texto plano sin HTML ejecutable, referencias de fuente y contraste con los colores del tema. No se añaden textos institucionales locales ni porcentajes de preparación. El resto del Centro de Implementación conserva sus pasos y acciones.

La consulta de activación queda protegida frente a respuestas antiguas durante cambio de ámbito o desmontaje. Sólo se usa un descriptor confirmado por esa lectura; un error o revalidación retira el lector, aunque la vista técnica preexistente conserve otros datos.

## Validación y límites de entrega

Tipos y 90 pruebas focalizadas aprobaron. Tres recorridos Chromium (1440 px claro, 390 px oscuro y 320 px claro) validaron carga diferida, foco, doble clic, versiones de fuente, rechazo de otra organización, denegación y retiro al cambiar cuenta. Cero escrituras y errores JavaScript; sin desbordamiento ni incidencias serias/críticas en el lector evaluado por axe. Se revisó la captura móvil. La prueba de 29 nodos es sintética: no certifica contenido ni vigencia institucional de los 29 menús originales.

La suite completa local y la compilación no se certificaron: Windows agotó memoria virtual (esbuild `VirtualAlloc errno=1455`) y el proceso de pruebas terminó. No se aumentaron límites del sistema, alteraron otras aplicaciones ni presentaron esos intentos como exitosos. Ambos workflows de GitHub deben certificar el SHA final en un runner limpio. Se extendió el workflow existente de acceso institucional, sin cambiar sus permisos ni retirar la navegación privada anterior. El workflow de rendimiento conserva sus pruebas completas y PWA.

Los primeros ensayos detectaron que el sanitizador canónico rechaza una ruta con segmento final vacío; la validación del slug ahora utiliza una ruta completa. También se preserva una referencia estable del descriptor durante el montaje para que un objeto equivalente no vuelva a consultar contenido innecesariamente. Se verificaron montaje/limpieza de StrictMode y retiro de respuestas, sin suprimir errores de producto.

## Bloqueos reales para cerrar Tierra del Fuego

La organización ID 46 y la acción de alta de Analía ya están registradas; no se recrean ni se cambia el propietario técnico. La entrada pública institucional volvió a aprobar sus tres pruebas. No se volvió a intentar descifrar, entregar o enviar la credencial cuyo uso fue bloqueado. El primer acceso nominal y la entrega segura siguen pendientes.

El contrato backend #2799 documenta que `private_conversation_guide` no es editable por los endpoints actuales y no incluye una operación de activación. Por eso este lector no puede habilitarse legítimamente guardando un campo ignorado ni escribiendo directamente la base. Hace falta completar esa operación administrativa soportada, desplegar el backend emparejado y aceptar las fuentes. No se activa por correo, por plan Full ni por el slug de TDF.

Vercel devolvió nuevamente 403 para `team_BV1xuY6BnEzGanfok8GAyjZv`. No se creó candidato ni se movieron aliases. Esta integración, junto con checkout/carrito pendientes, requiere acceso autorizado al equipo antes del despliegue. El código no es una certificación del acceso de Analía ni una afirmación de que la guía ya está en producción.

Fuente del contrato: `docs/TENANT_PRIVATE_CONVERSATION_GUIDE.md`, backend `ee92bb2af540d841ec2466238cf68b852be5c8c0`; referencia frontend original #1765. No se fusionó aquella rama ni se incorporaron sus módulos paralelos.
