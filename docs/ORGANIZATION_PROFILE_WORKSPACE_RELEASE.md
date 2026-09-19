# Perfil compartido por organizacion y vertical

TDF es un caso de marca blanca. Junin debe conservar su cuenta y conexion existente.
Ambos utilizan el mismo producto; esta entrega no crea una aplicacion por cliente.
El piloto TDF sigue siendo una evaluacion, no el CRM gubernamental completo.

Base frontend: fa63b8d184181f746237a5b8761de62f795e31f7, PR #1745.
Base backend: ee52d894a79cef47850ffc071374e9e08ce63ad0, PR #2781.

El perfil incluye un bloque opcional organization.profile_workspace.v1 que identifica
el tipo declarado por el servidor: municipio, gobierno, colegio, empresa o pyme.
Un tipo desconocido usa Organizacion; no se interpreta el nombre del cliente.
El formulario existente consume esa presentacion, sin nueva alta ni nueva consulta.
El permiso de editar permanece separado y no se modifica mediante ese bloque.

Las secciones existentes se conservan: datos, marca, ubicacion, horarios, canales
y plan/equipo. Se aclara que el sitio informativo no cambia el dominio de acceso.
Si existe registro de WhatsApp, se orienta a revisar esa conexion antes de otra alta.
El contrato no certifica entrega de mensajes ni aprobacion de plantillas.

## Validacion y limites

Se verifica version, identidad y estructura antes de usar el bloque. Cambiar de
organizacion o fallar la carga elimina la presentacion anterior; una respuesta de
otro tenant no se usa. No se admite que metadata adicional otorgue plan o permisos.
Los controles de guardado, cancelacion y modo lectura son los existentes.

Fixtures sinteticos generados por el builder real de backend; pruebas de parser,
componente y pagina Perfil. Navegador con componente real en 1440, 820, 390 oscuro
y 320 CSS px. No son dispositivos fisicos ni PWA instalada, ni una sesion de cliente.
La suite completa, tipos, build y evidencia del head se registran en el PR.

El backend debe publicar el campo para mostrar todo el vocabulario por vertical.
El frontend sigue compatible con el contrato anterior. No se alteran usuarios,
numero/callback de Junin, demo Conversa, planes, dominios, bases, Render o Neon.
La activacion comercial Full, el dominio verificado y el rol de usuario son gates
independientes. No hay migraciones ni librerias nuevas en este corte.

## Prioridades siguientes (planificado, no disponible por este cambio)

1. Edicion versionada de identidad y preferencias del tenant con permisos claros.
2. Invitaciones nominales y roles por organizacion, sin cuentas duplicadas.
3. Asistente de integraciones reanudable, conservando lo conectado previamente.
4. Dominio y PWA propios con DNS/TLS, aislamiento, instalacion y rollback comprobados.
5. Activacion gradual de modulos por vertical, contrato Full y permisos de cada rol.
6. Medicion de tiempo de alta, intervenciones de soporte y tareas realmente resueltas.

## Investigacion externa, 19/09/2026

Referencias de producto, no comparacion independiente de rendimiento:
- respond.io documenta organizacion, workspace, canales, agentes y equipo, con un
  onboarding guiado y Copilot de ayuda del producto. Criterio para Chatboc: separar
  ayuda de configuracion del agente que atiende al ciudadano/cliente, y medir alta
  autoservicio sin repetirla: https://respond.io/help/quick-start
- Jelou muestra agentes que ejecutan procesos y un flujo de construir, probar y
  publicar. Criterio: priorizar tareas verificadas (reclamo/pedido/pago) con control
  humano, no sumar respuestas sin efecto real: https://jelou.ai/en/
- Twilio documenta el onboarding Tech Provider y vinculos por negocio. Mantener
  identidad de cuenta/sender y autorizacion por organizacion antes de conectar:
  https://www.twilio.com/docs/whatsapp/isv/tech-provider-program/integration-guide
- Vercel documenta verificacion y configuracion de dominios multi-tenant. Un campo
  de sitio web no sustituye esa alta: https://vercel.com/docs/platforms/multi-tenant-platforms/configuring-domains

Bibliotecas comprobadas en package-lock: React/ReactDOM 18.3.1, Vite 6.4.3,
Clerk React 5.61.8, TanStack Query 5.90.20 y Playwright 1.58.1.
React documenta 19.3 como version actual: https://react.dev/versions
Vite documenta parches regulares para 8.3 y seguridad para 6.4: https://vite.dev/releases
No se instalaron majors en un sprint de continuidad. Abrir trabajo de compatibilidad
React 19 (incluido ecosistema Three/Clerk) y Vite actual con mediciones y regresiones
antes de modificar el lock. Ni el numero de version ni una animacion certifican calidad.

## Correccion visual encontrada durante la revision

La primera captura movil mostro que la navegacion ensanchaba la columna implicita
del grid: el navegador desplazaba horizontalmente el formulario y ocultaba titulo
y contenido, aunque el documento no tuviera overflow. Se limito la columna a
minmax(0,1fr) y se ajustaron min-width del formulario, contenedor y navegacion.
El test comprueba ahora scrollLeft del formulario y visibilidad del titulo despues
de navegar, ademas del ancho total. Los cuatro recorridos se repitieron y pasaron;
se revisaron las capturas de 390 y 320 px. El estado de solo lectura usa contraste
del tema y las transiciones no se ejecutan con movimiento reducido.

La suite completa local anterior al ultimo ajuste CSS paso 2.976 pruebas / 394
archivos; tipos y build tambien pasaron. Despues del ajuste de ancho se repitieron
49 pruebas focales y cuatro navegadores. CI del commit final vuelve a ejecutar la
suite completa, ambos typechecks, build y navegador; no reutilizar la corrida previa
como certificacion de un head nuevo hasta que esa CI termine.
