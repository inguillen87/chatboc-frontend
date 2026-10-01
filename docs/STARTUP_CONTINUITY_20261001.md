# Continuidad de ingreso y lecturas ante un arranque real

La sesión real del operador ya abría el SuperAdmin, pero requería Reintentar ante un contenedor frío. Este corte complementa la corrección SQL del backend, no sustituye autenticación por una sesión de muestra.

La espera inicial ahora también reconoce chatboc.ar y sus subdominios, respetando el override explícito de despliegue, las presentaciones independientes y el funcionamiento sin conexión. La preparación compartida dura 30 segundos; una señal real de reinicio retira el éxito anterior, sin cancelar la preparación que estén compartiendo otros solicitantes.

Cada solicitud conserva su URL, cuerpo, cabeceras e identidad. Sólo continúan automáticamente GET/HEAD y el intercambio exacto de sesión Clerk si el servidor acredita `chatboc.bootstrap.v1`, HTTP 503, `retryable:true`, `request_dispatched:false`, `ok:false`, `action_hint:retry_after` y la cabecera del límite de arranque. Se admiten como máximo dos continuaciones, con espera del servidor, presupuesto acotado y nueva comprobación de preparación. Una respuesta malformada o sin esa evidencia no autoriza continuar.

No se repiten automáticamente pedidos, pagos, mensajes, onboarding o cualquier operación singleAttempt. El intercambio Clerk ya no cambia de ruta/servidor ni sigue redirecciones ante un error de red o un resultado incierto. Los fallos genéricos, denegaciones y 5xx reales conservan su manejo; una señal de arranque reconocida no deriva a un backend antiguo como supuesto fallback.

El efecto Clerk cancela su transporte al retirarse. Un cambio de identidad/tenant durante la espera impide enviar otra solicitud con el contexto anterior. No se imprimen tokens, cuerpos ni secretos. Los loaders existentes permanecen montados durante la espera; los errores definitivos siguen visibles.

Las pruebas utilizan el transporte apiFetch real además de la unidad de continuidad: origen fijo, recibo incompleto, cancelación, singleAttempt, fallo de red, presupuesto y retiro del éxito de preparación. El mock global de apiFetch exigió importActual en la batería integrada; no se reemplazó el producto por ese mock para hacer pasar las aserciones.

La revisión de rutas de administración esperaba el backend canónico antiguo aun en la rama de aceptación. Se actualizó al deployment exacto de esta prueba, manteniendo el orden CSV → SPA HTML → API y las ocho rutas de proxy. No se reemplaza por un permiso para cualquier host.

El backend añade el campo de no-despacho sin alterar sus límites. Este frontend no infiere esa propiedad de un 503 genérico. RFC 9110 sección 9.2.2 es la referencia sobre repetición de solicitudes no idempotentes no aplicadas.

La ejecución efectiva, las cifras y la publicación se registran en el PR por revisión. Este archivo no acredita una conmutación productiva, acceso nominal de clientes, WhatsApp real o cierre de la ventana posterior al respaldo. El contenido y las fuentes de TDF permanecen sin cambios; MuniControl queda fuera de alcance.

## Ajuste del escenario oscuro de arranque

El primer CI aprobó 4109 pruebas y los presupuestos, pero el escenario oscuro intentaba modificar el documento durante una navegación y perdió su contexto. El artifact se descargó y su digest se comprobó; los otros cuatro recorridos habían aprobado. Una inyección temprana de la clase se sobrescribía al montar la aplicación y el control de tema estaba dentro del menú móvil, por lo que esos intentos no se aceptaron como cobertura oscura.

El fixture ahora establece antes de navegar únicamente la preferencia `theme=dark`, que index.html ya utiliza, y exige la clase renderizada antes de capturar. No se alteran el producto, los límites de espera, el aislamiento de HTTP ni las aserciones de arranque. La ejecución final de este ajuste queda sujeta a CI; el último comando de comprobación local fue bloqueado antes de ejecutarse y no se declara aprobado.
