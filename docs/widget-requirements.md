# Requisitos del Widget

Este documento resume los lineamientos para que el widget de Chatboc funcione de manera consistente en cualquier sitio donde se integre.

## UI/UX unificada
- El `iframe` o `script` debe verse igual que en la web principal.
- Mantener animaciones, colores, tipografía, logos y botones sin alteraciones.
- Verificar en escritorio y en dispositivos móviles reales.

## Soporte responsivo
- El widget no debe provocar desplazamientos dobles ni romper el diseño en pantallas pequeñas.
- El teclado en móvil no debe ocultar la interfaz ni dejar elementos fuera de vista.
- Incluir `viewport-fit=cover` en la meta `viewport` para aprovechar las zonas de seguridad (notches) en iOS y Android.

## Aislamiento de estilos
- El CSS del sitio host no debe afectar al widget. Usar Shadow DOM o clases únicas si es necesario.
- Probar con páginas externas que tengan estilos agresivos o reglas globales.
- Al incrustar con `widget.js`, incluir `data-shadow-dom="true"` para aislar los estilos del widget.

## Aislamiento de JavaScript
- Los errores de otros scripts en la página no deben interferir con la lógica del chat.
- Registrar errores por consola de manera clara.

## Seguridad y tokens
- El token puede recibirse vía atributo `data`, querystring o header.
- El rubro también puede enviarse con el atributo `data-rubro` del script para que el iframe lo reciba desde el inicio.
- Cada token está asociado a un único rubro/empresa/municipio.
- Se deben poder cargar múltiples widgets en una misma página sin mezclar la información.

## Usuarios registrados y anónimos
- Usuarios anónimos tienen funcionalidades limitadas (sin GPS, sin chat en vivo).
- Cuando una acción requiere autenticación se abre un formulario dentro del widget con nombre, email, celular y contraseña. El usuario queda asociado a la empresa o municipio según el token del iframe.
- Usuarios registrados acceden con email y contraseña, y ven su historial y archivos según la empresa asociada.
- Si el visitante ya tiene cuenta puede iniciar sesión desde el mismo widget sin salir de la página.
 - El bot puede incluir botones con `action` `login` o `register` (también `loginpanel`, `registerpanel`, `chatuserloginpanel` o `chatuserregisterpanel`) para abrir esos formularios directamente dentro del chat.


## Mini panel de usuario
- Al iniciar sesión se muestra un pequeño dashboard con historial, perfil y promociones. Allí el usuario puede actualizar sus datos personales sin acceder al panel administrativo de la empresa.
- El ícono de usuario en el encabezado del chat abre este panel. Si el visitante no está autenticado se le muestra el formulario de registro dentro del widget.
- Desde el formulario de registro hay un enlace para ir a la pantalla de inicio de sesión y viceversa.
- Desde este panel el usuario ve sus reclamos abiertos y cerrados y puede editar su nombre, email o teléfono sin salir del chat.

## Panel CRM para administradores
- En el perfil del administrador existe una sección para listar clientes o vecinos registrados.
- El listado permite filtrar por nombre, edad o zona y exportar los datos para campañas de marketing.
- Como futuro desarrollo se podrán enviar mensajes masivos por email o WhatsApp.

## Permisos de GPS y CORS
- Solo se solicitan coordenadas a usuarios registrados y se muestra un mensaje claro si se niegan permisos.
- Documentar cualquier uso de cookies o configuración de CORS necesaria.
- Si incrustás el widget con un `<iframe>`, incluí `allow="clipboard-write; geolocation; microphone; camera"` para habilitar la solicitud de ubicación o medios. Al usar el `<script>` `widget.js`, ese permiso se aplica automáticamente al iframe generado. Si tu página carga el widget dentro de otro iframe, ese contenedor externo también debe tener `allow="clipboard-write; geolocation; microphone; camera"`.

## Soporte para `iframe` y `script`
- Ambas formas deben comportarse de la misma manera. Documentar pros y contras.

## Modo demo y modo real
- Debe existir un modo de prueba para que el cliente evalúe el widget antes de contratar el plan.
- El modo real respeta los límites y funcionalidades según el plan.

## Facilidad de integración
- El código para incrustar el widget debe ser de copiar y pegar, con ejemplos para WordPress, Tiendanube, Shopify y sitios HTML simples.

## Propiedad opcional `ctaMessage`
- Se puede mostrar un globo de texto junto al botón de chat cuando está cerrado.
- El mensaje se define desde el backend y se pasa al componente como `ctaMessage`.
- Al usar `widget.js` se envía mediante el atributo `data-cta-message` del `<script>`.
- Si se envía, el globo aparece unos segundos para invitar al usuario a abrir el chat.
- La burbuja solo se muestra la primera vez gracias a `localStorage` (clave `cta_seen`).
- Puede reproducir un sonido opcional al aparecer si se incluye un archivo `public/beep.wav`.


## Soporte y mensajes de error
- Si ocurre un fallo de carga se muestra un mensaje amigable con enlace a soporte.
