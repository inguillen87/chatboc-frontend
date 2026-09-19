# SS-RUNTIME-RESUME: recuperación después de abrir el espacio

Base revisada: frontend 793c44a (#1750); backend de verificación 4b1223ff (#2785).
La pantalla de arranque ya existía. Este corte mejora la barra del espacio abierto,
sin reemplazar el formulario, reiniciar la sesión o recargar automáticamente.

## Comportamiento

Al perder conexión se muestra un aviso. Al recuperarla se consulta GET /api/version
mediante el verificador existente, sin cookies y con su límite de tiempo. Al volver
a una pestaña después de 30 segundos también puede consultar. No hay polling,
cron, keepalive ni consultas nuevas mientras la pestaña está oculta. Una consulta
compartida que ya estaba pendiente puede terminar dentro de su presupuesto.

La reconexión invalida una observación ya resuelta; no duplica un GET que sigue
pendiente. Se conserva el pin de versión por publicación. Un resultado de otro
intento no borra el estado nuevo. Reintentar es explícito; sólo comprueba el servicio.
Ningún POST/PUT/PATCH/DELETE, pago, mensaje o cambio se reenvía desde esta barra.
El estado disponible no confirma acciones anteriores: se indica revisar su resultado.
La elegibilidad existente por entorno/dominio/presentación se conserva. En un dominio
white label debe habilitarse la comprobación según su configuración, no por el logo.

Los formularios existentes mantienen su propio manejo de permisos, errores y datos.
El componente no persiste borradores offline y no promete recuperarlos tras cerrar.
No se deshabilitan tareas de la página por el indicador de red; la comprobación
manual de esta barra espera que el navegador indique conexión y haya configuración.

## UX y corrección encontrada en la aplicación completa

Barra no modal con estados distintos: desconexión informada, comprobación,
espera, servicio disponible, error y versión incompatible. Textos de plataforma
neutros, tema claro/oscuro, foco visible, controles de 44 px y regiones vivas.
El movimiento reducido del sistema/aplicación detiene el indicador animado.

La prueba con la SPA real encontró que la cabecera fija tapaba el botón de cerrar
la barra. Se añadió medición de su altura real, incluyendo cambios de tamaño y
safe areas; el aviso queda por debajo de esa cabecera. No se aumentó z-index para
ocultar la navegación. El observador limpia listeners y respeta un offset posterior.

## Evidencia y límites

21 regresiones nuevas: 12 de recuperación, tres de refresh compartido y seis de
medición de cabecera. Cuatro escenarios de navegador usan barra/hook/gate/CSS reales
con API sintética: escritorio, tablet, móvil oscuro y 320. Verifican conservación
de la edición, recuperación por teclado, respuesta lenta y versión incompatible.
El runner de perfil completo agrega desconexión/reconexión, GET real y edición no
guardada antes de continuar las pruebas existentes con sesiones desechables.
La red de ese escenario se representa por eventos del navegador, no una caída
física de infraestructura. CI frontend ejecuta los fixtures; el runner con ambos
repositorios se prueba localmente y se reporta por separado.

Se perfiló el arranque completo en un proceso local aislado. La medición incluye
esquema y usuarios de prueba, por lo que NO es un benchmark de producción. La
carga diferida, hook de warmup y bytecode precompilado ya existen. Este corte no
altera el runtime backend ni afirma reducir una latencia remota o eliminar el 503.

## Publicación

Usar el builder de QA con BackendOrigin y BackendRevision del candidato ya
comprobado y el verificador de par de #2785. Reutilizar el backend df6c321d cercado
para escrituras; no hace falta otro build backend por este cambio de interfaz.
Los resultados de CI y el candidato exacto se registran en el PR después de medirlos.
Un par de versiones verificado no certifica MFA, sesión institucional desplegada,
permisos de escritura QA, entrega WhatsApp, aprobación de Meta o dispositivos físicos.
No se modifican Junín, Agente Conversa, sus números, cuentas, planes ni dominios.

## Referencias primarias consultadas

- El indicador online del navegador es una señal de red, no una comprobación
  fiable de Internet o de un servicio concreto:
  https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine
- Los contenedores Vercel vuelven a cero tras inactividad; no se introduce un
  cron de calentamiento para encubrir esa política o aumentar consumo:
  https://vercel.com/docs/functions/container-images

El aviso de GitGuardian sobre previewBackendTarget.mjs:9 del PR padre se revisó:
la línea comprueba url.username/url.password para rechazar credenciales en URLs;
no almacena una contraseña. No se elimina esa validación ni se desactiva el escáner.
No hay nuevas dependencias, cambios de plan o contratación de capacidad adicional.
