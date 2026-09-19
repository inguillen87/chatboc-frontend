# Perfil institucional: guardado y revision de versiones

Estado: implementacion para release coordinada. Base frontend 0c9b0b5 y backend 99cdab59.
Se retoma el sprint local anterior y se completan sus controles antes de publicarlo.
No se crean cuentas nuevas ni otra aplicacion para cada cliente.

El formulario institucional usa el endpoint administrativo del tenant existente,
con revision de contenido y recibo de persistencia. El endpoint de perfil personal
se conserva para su finalidad original. Imagen personal y marca institucional son
campos de alcance diferente.

Una diferencia de version conserva la edicion y permite consultar la version actual.
La comparacion muestra ambos valores; los conflictos requieren seleccion explicita.
Latitud y longitud se eligen juntas. La seleccion prepara la edicion y no guarda.

## Controles de interfaz

Contador de datos pendientes y confirmacion antes de descartar. Se instala el aviso
nativo de cierre solamente mientras existen cambios; su disponibilidad depende del
navegador. El guardado persistente de borradores offline queda fuera de este corte.
Descartar recupera la ultima version leida y no envia una escritura al servidor.
El cambio de organizacion invalida respuestas anteriores y limpia datos de la vista.

Una operacion a la vez, sin reintentos automaticos. El timeout no afirma cancelar una
transaccion remota. Respuestas sin contrato, tenant o valores coincidentes no se
muestran como guardado. Un rechazo de acceso retira datos y controles anteriores.
Un backend que no publique el contrato nuevo deja el guardado institucional en
consulta: publicar frontend y backend coordinadamente, sin volver al PUT incorrecto.

Los horarios desconocidos no se inventan. El nuevo contrato guarda horarios
institucionales en configuracion del tenant sin cambiar silenciosamente el campo
personal/legacy del operador. Su uso por bots o rutinas de enrutamiento requiere
integracion posterior y no se da por completado por este formulario.

## Validacion y limites

Pruebas de parser, hook, comparacion y pagina real; fixtures generados desde el
builder del backend. Recorridos Chromium en 1440, 820, 390 oscuro y 320 CSS px.
Son regresiones con datos sinteticos, no acceso institucional ni dispositivos fisicos.
El browser prueba eleccion explicita, navegacion por teclado y ausencia de overflow.
Una primera consulta de status ambigua se corrigio con un nombre accesible especifico.
Se verifican tipos, suite completa y build por commit; resultados en el PR.

No se modifican cuentas, numeros, callbacks, planes, dominios de clientes ni datos
productivos. La fase de guardado no completa marca blanca, instalacion PWA, pruebas
del proveedor ni las ocho migraciones de infraestructura pendientes.

## Referencias aplicadas (consulta 2026-09-19)

- respond.io separa configuracion del workspace, identidad personal y permisos:
  https://respond.io/help/workspace-settings/users
- RFC 9110 describe precondiciones para evitar lost updates:
  https://www.rfc-editor.org/rfc/rfc9110.html#name-if-match
  Este contrato emplea expected_revision en JSON; no afirma implementar If-Match.
- React documenta cleanup para evitar aplicar respuestas obsoletas:
  https://react.dev/reference/react/useEffect

Se aplica el principio de colaboracion segura; no se afirma paridad comercial ni
rendimiento superior sin mediciones. No se agregaron librerias ni upgrades de major.
