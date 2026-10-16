# Marca y URLs de organizaciones — consola del SuperAdmin

## Base y alcance
Base productiva observada: `bef9bfd912cb2074ff7ed5de651042b5c1b2d37e`, deployment `dpl_ErBt5noRM4d6oqvwDgTkds8MDRJC`. El backend permanece en `912446bf96f8330664a9dec009ae57dbf935c73c`.
Este bloque agrega al directorio del SuperAdmin la acción **Marca y URLs**, utilizando exclusivamente endpoints ya existentes. No aplica el parche de autenticación del PR #1765 ni provisiona cuentas. El requisito de la misma cuenta ingresando por el dominio central y la URL institucional sigue siendo un cierre independiente, no queda completado por mostrar enlaces.

## Funcionamiento
La vista solicita primero la configuración administrativa autorizada de la organización y después su identidad pública. Valida slug en ambos contratos y el ID explícito de la respuesta pública. No muestra el contenido hasta completar ambas verificaciones. Los errores retiran las respuestas anteriores; cambiar la selección o cerrar el panel invalida las respuestas tardías.
Compara nombre, logo y color primario publicados con los valores configurados cuando son comparables. No infiere qué versión es más reciente ni presenta esa coincidencia como verificación de DNS, certificados o usuarios.
Muestra el ingreso central y la ruta pública de la organización en ChatBoc. Sólo presenta un dominio externo cuando el backend lo declara y cumple el formato HTTPS público permitido. No deriva un dominio propio del slug ni inventa un endpoint de login externo. Direcciones con credenciales, parámetros sensibles, protocolos inseguros o destinos locales no se abren ni copian.
Los logos se filtran antes de renderizarse, sin credenciales o referrer, y tienen fallback ante error. Los colores admiten únicamente valores hexadecimales de seis dígitos. Los tokens/configuraciones restantes de las respuestas se descartan y no se incluyen en estado, reporte o interfaz.
Las acciones **Editar organización** y **Administrar accesos** abren los controles existentes sobre el mismo tenant verificado. Este módulo no envía una mutación ni cambia contraseñas, roles, dominios o planes.

## Interfaz
Comparación en dos columnas en escritorio, una en móvil; enlaces seleccionables/copiar/abrir; foco visible y restauración de foco al cerrar. Los enlaces externos abren sin opener/referrer. El diálogo respeta movimiento reducido y tiene objetivo táctil de 44 px para el cierre.
No existe un flujo nuevo de autenticación, SSO ni transferencia de credenciales entre dominios. Una demo separada no se presenta como una organización provisionada.

## Validación
TypeScript aprobado. Suite completa local: **3343 pruebas en 416 archivos**, cero fallidas o pendientes; son 35 casos nuevos sobre la base publicada. Se preservaron las pruebas existentes del directorio.
Tres recorridos Chromium sintéticos en 1440×1000, 390×844 oscuro y 320×740 validaron lectura secuencial, dominio ausente, retiro de datos tras error, apertura de edición, regreso de foco, movimiento reducido, ausencia de desbordamiento y cero infracciones serias/críticas de axe en el diálogo. No hubo solicitudes de escritura. No son pruebas de credenciales reales ni de cuentas institucionales.
Se corrigió el retorno involuntario del mock desde `beforeEach`, que Vitest interpretaba como callback de limpieza; se conservaron las aserciones de rechazo HTTP.
Una preparación adicional de pruebas de componente fue rechazada por la herramienta y no se incorporó por otra vía. Los resultados informados corresponden únicamente a los archivos de prueba efectivamente ejecutados y al recorrido navegador documentado.

Comandos: `npm run typecheck`, `npm test -- --maxWorkers=4`, `node tests/organization-presence.browser.mjs`.
El workflow `Organization brand and URLs` ejecuta esos controles, build y captura de evidencia. Su resultado y la publicación se registran por SHA en el PR. Antes de mover los dominios se verifican build productivo, recursos, acceso anónimo, ausencia de publicación concurrente y rollback.
La instalación local reutiliza mediante una junction las dependencias de un worktree con el mismo package-lock, sin ejecutar otra instalación ni llenar el disco. No se borraron fuentes, configuraciones ni respaldos.

## Continuidad
Siguen pendientes la provisión institucional y el cierre del login central/por organización del PR #1765, así como la validación de propiedad, DNS y SSO para dominios propios. No se aplican esos cambios sensibles dentro de este bloque de lectura. Tampoco se modifica la migración Render→Vercel/Neon, las encuestas ni los canales de clientes.
