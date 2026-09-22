# Encuestas: confirmación vinculada al instrumento mostrado

Base de este sprint: frontend #1760 / b0c3ba0382b26d8a45014c84e2c25c90ce57a2a3.
Se conserva la línea de selección y biblioteca WhatsApp. No se modifica backend,
endpoints, publicación de encuestas, planes, roles o contenido institucional.

## Cambio

La tarjeta mantenía los diálogos por booleanos locales sin vincularlos al tenant,
contenido o ciclo de vida que el operador había revisado. Si el componente se
reutilizaba, una confirmación abierta podía acompañar al nuevo instrumento.
El doble clic dependía de que el padre actualizara sus flags antes de otra llamada.

La fachada SurveyCard vincula la vista a un snapshot de tenant, identidad, datos
mostrados, preguntas, métricas, gobernanza y lifecycle. Cambiar ese snapshot desmonta
sólo la vista anterior y su confirmación. Volver A-B-A no restaura un diálogo viejo;
una lectura idéntica conserva la interacción. La presentación original está en
SurveyCardView con el blob exacto de la base: no hay dos implementaciones activas,
nuevos textos locales ni cambios de la política legacy del componente.

useSurveyCardActions retira la capacidad de iniciar otra operación sincrónicamente:
dos confirmaciones simultáneas comparten la misma promesa; otra mutación se rechaza,
no se encola. Se comprueba la capacidad vigente y la vida del componente antes de
llamar el handler. Una vista desmontada no inicia trabajo pendiente. La tarjeta
muestra su estado local de cierre/borrado sin esperar el rerender del padre.
El resultado no es un recibo de persistencia ni sustituye autorización/idempotencia
de la API. Un handler debe rechazar si falla; el componente no deduce el resultado
remoto ni cancela una operación por desmontarse. No hay reintentos automáticos.

## UX

Los botones y detalles tienen objetivos táctiles de 44px; títulos/descripciones
pueden partir palabras largas. Las tarjetas de una grilla mantienen el pie alineado,
colores del tema y movimiento reducido. Se conserva la copia existente y los
estados declarados por backend; no se afirma aprobación/certificación de resultados.

## Verificación

Nueve tests del controlador y ocho de la tarjeta comprueban concurrencia local,
revocación, desmontaje, excepciones, cancelación, cambio de tenant/instrumento,
contenido y lifecycle, igualdad de snapshots y estados pendientes.
Cuatro recorridos Chromium usan la tarjeta/hook reales con datos y callbacks
sintéticos: 1440, 820, 390 oscuro y 320. Cambian contexto, revocan/restauran capacidad,
confirman por teclado/doble clic y comprueban una invocación, geometría y cero API.
Las capturas contienen exclusivamente datos de prueba y se conservan tres días.
Los resultados se anotan en el PR tras ejecutar CI; este documento no los presupone.

## Operación

La factura pendiente no impide continuar cambios y CI por GitHub. No se procesaron
pagos ni se supone que pagar resolverá un error de autorización. El intento actual
de acceder al deployment Vercel devolvió 403 de scope; Desktop Commander continúa
pausado por cuota. No se reiteran solicitudes remotas después del bloqueo.
No se cambió ningún alias ni se publicaron datos de clientes. Falta aceptación
integrada del panel/servidor y validación en el despliegue antes de promover.
