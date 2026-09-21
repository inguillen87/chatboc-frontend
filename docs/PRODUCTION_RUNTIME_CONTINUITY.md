# Recuperación del espacio sin perder la edición

Base productiva exacta: 9d85b481b026484dec0042b0b4193aac8c734e31 / PR #1757.
Este corte extrae únicamente la recuperación de conexión de la línea de configuración
6712bf1 y conserva el hotfix del perfil. No incluye sus contratos de marca, módulos,
guardado institucional, migraciones, planes o cambios de backend.

## Comportamiento
Barra no modal, debajo de la altura medida de la cabecera. Distingue desconexión
informada, comprobación, espera, error, versiones incompatibles y servicio verificado.
No recarga páginas ni reinicia sesiones. No persiste borradores: conserva la pantalla
que sigue montada y no promete recuperar ediciones después de cerrar.
Una comprobación anónima GET /api/version comparte la operación pendiente y una
observación de 30 segundos. No hay polling ni trabajo nuevo en pestañas ocultas.
Reconexión, retorno tras inactividad y pageshow.persisted permiten revalidar.
Una comprobación manual no queda bloqueada sólo por navigator.onLine=false.
Después de un intento manual fallido sin conexión se mantiene pendiente la
revalidación al reconectar. Ningún POST/PUT/PATCH/DELETE se reenvía.
El indicador de disponibilidad no confirma mensajes, pagos o guardados anteriores.

La política VITE_RUNTIME_RECOVERY_ENABLED es independiente del gate de arranque:
los dominios propios pueden mostrar recuperación sin bloquear el primer montaje.
La presentación institucional independiente de API permanece excluida.
Sin variables nuevas obligatorias, dependencias nuevas o capacidad contratada.

## Validación y publicación
Se verificaron focales locales antes de agotar la cuota de Desktop Commander.
La suite completa local quedó lanzada pero su resultado final no se recuperó;
no se presenta como aprobada. Se reconstruye este corte desde blobs exactos y
archivos revisados mediante GitHub. La CI del head vuelve a ejecutar tipos, suite,
build y ocho recorridos Chromium: cuatro de perfil y cuatro de recuperación.
Los recorridos de recuperación usan API y eventos de red sintéticos. No son una
prueba de caída física, sesión institucional, WhatsApp ni PWA instalada.
Resultados y recuentos definitivos se registran en el PR al finalizar.

Abrir el PR o pasar CI no publica producción. El despliegue requiere build con
entorno PRODUCTION, ocho rewrites a api.chatboc.ar, revisión/artefactos comprobados,
estado previo de los aliases y promoción explícita de un candidato READY.
Conservar dpl_2byACxumf1vYJHqeQZYD7P6A7HDY como reversión hasta completar el corte.
No se declara resuelto el arranque en frío del backend migratorio ni su aceptación.
