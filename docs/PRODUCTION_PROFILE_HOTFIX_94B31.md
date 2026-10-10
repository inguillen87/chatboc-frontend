# Perfil responsive: corrección aislada sobre la versión pública

Base verificada por la API de Vercel: frontend 3c430c2d6c7a470745a42f7e489b2e552726ef54,
deployment dpl_Go8eNRudNY1uT23kvWroRqgXuxKp. El hotfix no parte de main ni del candidato
migratorio; no requiere otro backend, nuevos permisos, DTO, esquema o credenciales.

Defecto reproducido en la base: navegar a la última sección en 820, 390 y 320 px
ensanchaba la grilla a 1208 px y desplazaba el formulario 430, 836 y 906 px. El título
quedaba fuera de vista. A 1440 px no ocurría. La comprobación de scroll interno es
necesaria: verificar sólo el ancho del documento no demuestra que el perfil se vea.

Cambio productivo acotado al componente InstitutionProfileWorkspace: grilla y
contenedores con ancho mínimo cero, una columna flexible en móvil, navegación
horizontal contenida y elementos sin encogerse; transición no esencial respeta
movimiento reducido, controles de acción de 44 px y margen inferior para safe area.
Contraste de indicadores/botón secundario y SVG decorativos fuera del árbol accesible.
No cambian textos, callbacks, props, condiciones de permiso ni operaciones de guardado.

La prueba de navegador usa el componente real y un formulario sintético; recorre
navegación, teclado, scroll, conservación de input, submit local y estado de sólo
lectura a 1440/820/390 oscuro/320. No escribe en API ni usa cuentas de clientes.
No equivale a una certificación física iPhone/iPad/Android ni de PWA instalada.

Publicación: compilar con entorno PRODUCTION, mantener rewrites a api.chatboc.ar,
crear primero un deployment --prod --skip-domain y verificar los artefactos antes de
promover. Conservar el deployment anterior como rollback. La promoción y sus pruebas
se registran en el PR después de ejecutarse; este documento no las presume terminadas.
La rama canónica de módulos sigue siendo #1756/#2790. Las variantes draft #1755/#2789
se cerraron como sustituidas sin borrar ramas ni fusionar DTO incompatibles. El corte
de migración/Full/marca blanca y WhatsApp TDF no se activa mediante este hotfix visual.
