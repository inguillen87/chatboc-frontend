# Espacio institucional integrado en Chatboc

Base frontend: 60fdccd825b4279698d85d54519ce8790aba15bf, PR #1798. Backend emparejado: #2806. Este corte modifica pantallas y transporte reales; no entrega un HTML al cliente ni crea otro sitio.

## Dentro del producto

- Centro de Implementación: la cuenta institucional verificada consulta/importa su versión de conocimiento, prueba respuestas y confirma publicación o retiro. El corpus preparado de TDF es un archivo de datos privado para esta operación, no un bundle público de React.
- Página pública del tenant: el mismo componente sólo aparece si el servidor entrega una versión publicada para esa organización. No toma textos de ejemplo o del perfil anterior cuando no hay fuente disponible.
- Sidebar por temas, lectura de respuestas sin adornos de chatbot, consulta por texto, referencias por documento/página, fragmentos suministrados, enlaces reales y tamaño de lectura ampliable. Nombre, etiquetas, opciones y contenido proceden del backend.
- Se conserva el inicio de la guía y sus opciones distintas aunque compartan destino. La respuesta de menú y de pregunta utiliza el mismo nodo canónico y sus referencias.
- El backend #2806 también conecta la versión al responder_chatboc existente, compartido por canales. No crea un segundo agente ni una base separada de respuestas para botones. El proveedor selecciona nodos mediante el helper LLM existente; no genera links o requisitos libres.

## Guardas

El componente se desmonta por cuenta/tenant, retira datos después de errores y descarta resultados tardíos. Una respuesta de otra organización/revisión/fuente es rechazada. No persiste la conversación en localStorage. Publicación e importación requieren confirmación; el PUT es de un único intento y la UI exige relectura coincidente. Una respuesta incierta no se reenvía. Cargar una versión no la publica automáticamente.

La importación admite el corpus compuesto ya preparado, no PDFs arbitrarios ni formatos no integrados. No se simula una indexación por subir un archivo. Las referencias sin URL siguen siendo citas documentales, no links inventados. Los documentos originales no se empaquetan en la aplicación ni se publican en Git.

## Pruebas

Se incorporan pruebas de parser/transporte, UI y navegación de la página de implementación real en 1440, 390 oscuro y 320. Las operaciones del navegador usan HTTP/sesión sintéticos y se mantienen sin mock los componentes, página y normalizadores. Los paneles de otras funciones de preparación, no usados por el escenario, están sustituidos. No se acredita una conversación con modelo externo ni un login de Analía.

El primer ensayo encontró el nombre accesible ausente en el botón Fuentes al ocultar su texto en móvil. Se añadió aria-label desde el texto backend y se repitieron los tres recorridos. Se corrigió la codificación de textos sintéticos pasados por la consola y el nombre de archivo de contrato para evitar la colisión .ts/.tsx en Windows. Estos incidentes no justificaron retirar pruebas.

Se conservan los workflows de ingreso institucional y rendimiento. Los recuentos finales deben comprobarse en los artifacts del SHA correspondiente; los ensayos locales no sustituyen ese cierre.

## Publicación

Este cambio todavía no se sirve en producción. Vercel devolvió 403 para el equipo del proyecto; no se cambió un alias ni se utilizó otra vía para eludir la restricción. No se enviaron mensajes, no se modificó la cuenta nominal ni se importó información en TDF. Para hacerlo visible faltan despliegue autorizado de ambos repositorios e importación/publicación de la versión privada del tenant 46. MuniControl fuera del alcance.

Resultado local previo al commit: TypeScript, 28 pruebas focalizadas y los tres recorridos de la p?gina real aprobaron. Por escenario se ejecutaron tres intentos sint?ticos de escritura: importaci?n y publicaci?n confirmadas, retiro denegado; no hubo cambios en producci?n. Se revis? visualmente la captura de escritorio. La validaci?n del SHA final corresponde a los workflows.
