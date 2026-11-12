# Acceso de demostración y menús con fuente

Alcance: un acceso de prueba aislado, no una cuenta nominal, no una nueva identidad
Clerk, no Full productivo. El módulo pertenece al mismo repositorio y proyecto Vercel.
Sólo se empaqueta en el candidato de evaluación; no cambia las rutas de la API pública.
La presentación anterior queda accesible mediante su URL inmutable, configurada en servidor.

El identificador de prueba y el hash scrypt se configuran únicamente en el entorno de
la función. No hay contraseña en React, en archivos públicos ni en el repositorio.
La cookie HttpOnly/Secure/SameSite=Strict tiene audiencia y espacio exclusivos, está
ligada al hostname y dura como máximo dos horas. El período de evaluación también
vence; deshabilitar el entorno o rotar su clave invalida todos sus accesos.
El cierre elimina la cookie del navegador; no hay registro durable de revocación por
sesión. El límite de intentos es acotado por worker, NO un bloqueo distribuido de cuentas.
Estas limitaciones impiden usar el módulo como reemplazo de la autenticación productiva.
No confirma correo o segundo factor, no envía email y no accede a clientes reales.

El frontend consume menús servidos tras autenticación. La fuente canónica está en el
backend y se fija por commit y SHA-256 en `server/evaluation/content.lock.json`.
El empaquetador obtiene/verifica el artefacto y sólo incorpora su contenido a la función
privada. El navegador recibe opciones y referencias de páginas, no secretos ni el PDF.
El recorrido es navegación determinista por opciones, no una conversación libre con LLM.
Hay vista de texto para WhatsApp; no representa un número conectado o un envío real.

`packageEvaluation.mjs` genera Build Output API v3: HTML/JS/CSS sólo del módulo,
una función Node y cero proxies de API hacia producción. No incluye manifest PWA,
service worker, portal administrativo ni otros HTML del SaaS. El dominio de prueba
no debe considerarse una PWA instalada certificada ni acceso a un CRM real.

Pruebas locales: diez pruebas Node de autenticación/HTTP y cuatro recorridos de
navegador con HTTPS de loopback, API real local y guía real fijada: escritorio 1440,
teléfono 390 oscuro, tablet 820 y ancho 320. Cubren ingreso, navegación, referencia,
derivación simulada, dos preguntas de cierre, recarga de sesión y logout. Sin fixtures
de red que falseen la respuesta del servidor. Los tamaños no son dispositivos físicos.
Capturas revisadas; sin desbordamiento horizontal en las comprobaciones ejecutadas.
Doce pruebas adicionales en el backend verifican el grafo y el adaptador TwiML.

La publicación y el cambio del alias de evaluación se registran separadamente en el
PR, con revisión exacta y prueba HTTP. No promover chatboc.ar ni api.chatboc.ar.
No conectar o reasignar un número de WhatsApp existente por empaquetar esta demo.
