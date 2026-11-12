# Cierre de cabecera y navegación privada

## Base preservada
Este lote parte de `ede86e70bc88e64e5c3915e98a528c029fe5a002` (PR #1781), no del white label anterior. Se mantienen las mejoras de recuperación por sección ya publicadas. No modifica autenticación, sesiones, provisión de usuarios, API, esquema, DNS, WhatsApp ni la migración Render→Vercel/Neon.

## Resultado visible
En el panel privado de una cuenta de organización, la cabecera utiliza el nombre y logo del perfil autenticado verificado. El enlace de esa marca vuelve a `/perfil` mediante navegación React, no a la landing comercial ni a una recarga completa. Si no hay logo seguro o la imagen falla se usa un icono neutro. Mientras el perfil se comprueba o la identidad no coincide, la cabecera es neutra y no conserva un nombre anterior como verificado.
El footer privado queda reducido al nombre institucional y enlaces legales de la plataforma. No mezcla publicidad, redes sociales o credenciales fiscales de ChatBoc con la marca de la organización. Esos contenidos siguen en las páginas públicas; no se reinterpretan como políticas de una institución.
El carrito público deja de aparecer dentro del panel privado. Las opciones y destinos administrativos existentes se conservan: no se agregan capacidades o permisos por presentar una marca. SuperAdmin, login central, portada y páginas públicas conservan su comportamiento de marca previo.
El menú móvil se cierra al cambiar de ruta, consulta, cuenta u organización; también al hacer clic o mover el foco fuera del encabezado. Escape conserva la devolución de foco al botón de apertura. Se libera el estado de overlay y se preserva el desplazamiento del menú largo. El diseño admite nombres extensos, pantallas estrechas, foco visible, objetivos táctiles y movimiento reducido.

## Autoridad de los datos
El selector requiere sesión y perfil verificados por los contextos ya existentes. No obtiene datos por su cuenta, no lee un nombre del almacenamiento local ni adopta el perfil público de una organización visitada. Contrasta los aliases del tenant, el contexto activo y cualquier selección explícita de ruta/query. Los roles de plataforma y usuarios públicos no reciben este white label privado.
El alcance está acotado a las rutas operativas reconocidas, incluido `/perfil` y sus secciones, pedidos, usuarios, tickets, encuestas y analítica administrativa. No se modifica el router ni se declara soporte universal de dominios o alias legacy. Una URL distinta no concede autorización.
La cuenta de Analía, el alta de Conversa/Tierra del Fuego y SSO entre dominios siguen fuera de este lote. Mostrar el panel con marca no equivale a completar esas altas o el white label de cada componente interno.

## Pruebas y revisión
La suite local completa aprobó **3482 pruebas en 425 archivos**, cero fallidas o pendientes: 47 casos nuevos sobre la base de 3435. Incluye retirada de identidad durante verificación/cambio de tenant, rechazo de contradicciones, fallback de imagen, aislamiento de plataforma, footer privado, navegación, Escape, foco exterior y revocación de sesión. TypeScript aprobado.
Un test existente del menú asumía un perfil sin evidencia de verificación. Se completó su fixture con los campos del contexto verificado y se precisó su consulta al nombre dentro del menú, porque ahora aparece también en la cabecera. Se conservaron las expectativas de organización, plan, configuración, sesión y destinos.
Tres recorridos Chromium pasaron en 1440×1000 claro, 390×844 oscuro y 320×740 claro, sin solicitudes de API privadas ni escrituras. Se revisaron capturas. Axe no detectó incidencias serias/críticas en cabecera/footer evaluados. Los componentes y selector de identidad son reales; la sesión es sintética y no acredita una cuenta productiva.
Las acciones reales de teclado y enlaces se probaron sin forzar clics. Los cambios externos de ruta/cuenta del fixture se despachan programáticamente cuando el menú cubre la pantalla; eso prueba el cierre ante un evento externo, no la accesibilidad de un botón situado detrás del menú. Se corrigió una importación relativa del fixture a la misma ruta canónica de módulo usada por los demás componentes.
Una llamada agrupada de edición/pruebas y una ampliación del guion de navegador fueron rechazadas. No se atribuye su contenido como ejecutado: el navegador cubre los casos presentes en el archivo final y las pruebas unitarias contienen los otros controles indicados.

Comandos: `npm run typecheck`; `npm test -- --maxWorkers=4`; `node tests/private-navigation.browser.mjs`.
Se amplió el workflow existente `Unified organization login` para incluir la navegación privada, sin crear un pipeline paralelo redundante. Su resultado, SHA, despliegue y verificaciones productivas se registran en el PR. La publicación exige fuente limpia, CI aprobado, build verificada, recursos de la nueva implementación, canary público y preservación del rollback.
Referencias de implementación: patrón de navegación disclosure de WAI-ARIA APG (W3C) y limpieza de efectos React. No se cambió la navegación a `role=menu` ni se exige una interacción de teclado de menú de aplicación a los enlaces normales.
