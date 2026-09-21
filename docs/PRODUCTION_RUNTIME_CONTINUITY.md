# Recuperación del espacio sin perder la edición

Base frontend exacta: 9d85b481b026484dec0042b0b4193aac8c734e31 / PR #1757.
Corte frontend #1758 y configuración pública backend #2791. No contienen los
contratos de marca/módulos o la cadena de migración. El perfil responsive publicado
se conserva sin modificar su contrato de guardado.

La barra no modal queda fuera del flujo del documento y debajo de la cabecera
medida. Distingue desconexión informada, comprobación, espera, error, versiones
incompatibles y servicio verificado. No recarga ni reinicia sesiones, y no promete
persistencia después de cerrar el documento.

Todos sus textos y etiquetas vienen del JSON público backend; en runtime el
frontend sólo define el esquema y los estados técnicos, no mensajes de respaldo.
Al comenzar online hay una carga anónima compartida de configuración; sin copia
válida al empezar offline no se inventa una barra. Backend anterior sin el nuevo
endpoint sigue compatible: la aplicación continúa sin esta nueva presentación.

La verificación de disponibilidad usa GET /api/version con operación pendiente
compartida y una observación de 30 segundos. No hay polling ni comprobaciones
nuevas en pestañas ocultas. Reconexión, retorno tras inactividad y BFCache permiten
revalidar; comprobación manual no depende sólo de navigator.onLine. Nunca reenvía
POST/PUT/PATCH/DELETE ni confunde disponibilidad con entrega o guardado.

VITE_RUNTIME_RECOVERY_ENABLED permanece independiente del gate de arranque. La
política deshabilitada y la presentación institucional excluida no muestran la
barra siquiera al empezar offline. No hay nuevas variables obligatorias.

La CI verifica tipos, suite, build y navegadores con datos/eventos sintéticos.
Los resultados exactos por head se anotan en el PR. El endpoint backend se prueba
sobre su blueprint real en Flask desechable, no una sesión institucional completa.
No hubo pruebas nuevas con datos de clientes, mensajes externos o dispositivos.

Publicar exige acceso autorizado, backend #2791 comprobado, build frontend con
PRODUCTION, rewrites hacia api.chatboc.ar, candidato verificado y promoción con
revisión posterior. No se ha realizado ese despliegue. Conservar el deployment
anterior dpl_2byACxumf1vYJHqeQZYD7P6A7HDY como reversión del frontend. No se declara
resuelto el arranque en frío del backend migratorio ni su aceptación completa.
