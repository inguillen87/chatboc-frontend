# SS-ORGANIZATION-SETUP: configuración guiada sin duplicar aplicaciones

Base frontend d6ba7e61; backend coordinado sobre 4b1223ff.
El centro de implementación presenta primero el recorrido operativo publicado
por el backend para municipio, gobierno, colegio, empresa, pyme u organización.
Las herramientas de provisión gubernamental quedan en una sección diferenciada
y no se presentan para tipos no gubernamentales declarados en el contrato nuevo.

Cinco pasos navegables, estado verificable, siguiente acción y detalle del paso.
El administrador puede revisar otro paso sin ejecutar cambios. Los textos,
fuentes y decisiones por vertical provienen del servidor. Colores, tipografía,
controles táctiles, teclado, modo oscuro y movimiento reducido comparten el
sistema visual existente. No se agregan librerías ni contenido propio de TDF.

Se conserva el v1 cuando no se publicó la proyección nueva; una proyección v2
presente pero inválida no se reconstruye ni se sustituye por progreso inventado.
Validación del tenant/ID, fuentes, estructura, estados y totales. El progreso
refleja esta lista de preparación, no equivale a operación productiva aprobada.

## Aislamiento y continuidad

El componente de activación se reinicia por scope y descarta respuestas de
solicitudes anteriores, incluido A-B-A. Sin scope no consulta el endpoint global.
Rechazos de acceso y contratos inválidos eliminan la vista anterior. Un fallo de
red del mismo tenant conserva información con aviso, pero retira las acciones
hasta revalidar. Un solo refresh simultáneo. Los enlaces de ida y retorno no
pueden dirigirse a otro tenant; las acciones de API no se convierten en enlaces.

## Correcciones encontradas con la aplicación completa

La ruta /implementacion no estaba reservada y podía confundirse con un slug,
provocando consultas a /api/implementacion/carrito. También mostraba el widget
público y el pie comercial dentro del área de trabajo. Se añade la ruta a las
listas existentes para evitar esa inferencia, ocultar el launcher público y
mantener el contenido administrativo libre de footer de marketing.
La captura oscura reveló bajo contraste en el encabezado común; ahora usa fondo
y texto del tema de forma explícita, sin degradado que vuelva ilegible el título.

## Pruebas y evidencia

Fixture JSON de seis tipos generado por el builder real del backend. Tests de
parser, CTA segura, estado obsoleto, revocación, A-B-A, navegación y un refresh.
El runner coordinado usa la SPA completa y autenticación/backend originales,
con cuentas y base desechables: abre /implementacion, consulta su contrato,
inspecciona pasos y captura escritorio/tablet/móvil oscuro/320. No son dispositivos
físicos ni sesiones institucionales en el despliegue remoto. Los logs y resultados
finales por commit se registran en el PR; el runner cross-repo se ejecuta localmente.

CI del frontend conserva suite completa, tipos/build y navegadores anteriores;
CI backend añade la proyección y dos recorridos HTTP. No se afirma que el runner
SPA completo sea un job cross-repo de CI. Las pruebas de otros sprints no se suman
como nuevos casos ni se presentan como aceptación productiva.

Pendientes separados: editor granular de módulos, marca blanca completa, dominios,
MFA institucional, operación real WhatsApp, escritura en QA, migraciones y arranque
en frío. Esta fase no cambia las cuentas ni números ya asignados a organizaciones.
