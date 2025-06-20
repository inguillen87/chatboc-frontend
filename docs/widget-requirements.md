# Requisitos del Widget

Este documento resume los lineamientos para que el widget de Chatboc funcione de manera consistente en cualquier sitio donde se integre.

## UI/UX unificada
- El `iframe` o `script` debe verse igual que en la web principal.
- Mantener animaciones, colores, tipografía, logos y botones sin alteraciones.
- Verificar en escritorio y en dispositivos móviles reales.

## Soporte responsivo
- El widget no debe provocar desplazamientos dobles ni romper el diseño en pantallas pequeñas.
- El teclado en móvil no debe ocultar la interfaz ni dejar elementos fuera de vista.

## Aislamiento de estilos
- El CSS del sitio host no debe afectar al widget. Usar Shadow DOM o clases únicas si es necesario.
- Probar con páginas externas que tengan estilos agresivos o reglas globales.

## Aislamiento de JavaScript
- Los errores de otros scripts en la página no deben interferir con la lógica del chat.
- Registrar errores por consola de manera clara.

## Seguridad y tokens
- El token puede recibirse vía atributo `data`, querystring o header.
- Cada token está asociado a un único rubro/empresa/municipio.
- Se deben poder cargar múltiples widgets en una misma página sin mezclar la información.

## Usuarios registrados y anónimos
- Usuarios anónimos tienen funcionalidades limitadas (sin GPS, sin chat en vivo).
- Usuarios registrados acceden con email y contraseña, y ven su historial y archivos según la empresa asociada.

## Mini panel de usuario
- Al iniciar sesión se muestra un pequeño dashboard con historial, perfil y promociones.

## Permisos de GPS y CORS
- Solo se solicitan coordenadas a usuarios registrados y se muestra un mensaje claro si se niegan permisos.
- Documentar cualquier uso de cookies o configuración de CORS necesaria.

## Soporte para `iframe` y `script`
- Ambas formas deben comportarse de la misma manera. Documentar pros y contras.

## Modo demo y modo real
- Debe existir un modo de prueba para que el cliente evalúe el widget antes de contratar el plan.
- El modo real respeta los límites y funcionalidades según el plan.

## Facilidad de integración
- El código para incrustar el widget debe ser de copiar y pegar, con ejemplos para WordPress, Tiendanube, Shopify y sitios HTML simples.

## Soporte y mensajes de error
- Si ocurre un fallo de carga se muestra un mensaje amigable con enlace a soporte.

