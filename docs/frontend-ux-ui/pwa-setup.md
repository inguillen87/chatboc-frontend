# Documentación: Configuración Inicial de PWA

Este documento detalla la configuración inicial implementada para habilitar la funcionalidad de Progressive Web App (PWA) en la plataforma Chatboc. El objetivo es permitir que la aplicación sea instalable en dispositivos y ofrezca una experiencia de usuario mejorada con caching básico.

## 1. Web App Manifest (`public/manifest.json`)

El archivo `manifest.json` proporciona información esencial sobre la aplicación al navegador.

-   **Ubicación:** `public/manifest.json`
-   **Contenido Clave Actualizado:**
    -   `name`: "Chatboc - IA para Gobiernos y Empresas"
    -   `short_name`: "Chatboc"
    -   `description`: "Plataforma IA con CRM y Chatbots para optimizar la comunicación y gestión en municipios y empresas."
    -   `lang`: "es-AR"
    -   `start_url`: "/"
    -   `display`: "standalone" (para una experiencia similar a una app nativa)
    -   `background_color`: "#FFFFFF" (para la splash screen)
    -   `theme_color`: "#007AFF" (color primario de la aplicación, usado en la barra de título de la app en algunos contextos)
    -   `orientation`: "portrait-primary"
    -   `icons`:
        -   Incluye referencias a íconos existentes en `public/favicon/` (`favicon-192x192.png`, `favicon-512x512.png`, `favicon-32x32.png`, `chatboc_widget_64x64.png`).
        -   **Importante:** Se han añadido entradas para íconos `purpose: "maskable"` (ej. `/favicon/favicon-maskable-192x192.png`). Estos son cruciales para una correcta visualización del ícono en todos los dispositivos Android. **Acción Pendiente:** Crear y añadir estos archivos de íconos maskable reales en la carpeta `public/favicon/`. Actualmente, los `src` de los maskable apuntan a los íconos normales como placeholders.
-   **Enlace en `index.html`:**
    ```html
    <link rel="manifest" href="/manifest.json">
    ```

## 2. Meta Tags en `index.html`

Para complementar el manifest y mejorar la integración PWA:

-   **`theme-color`:**
    ```html
    <meta name="theme-color" content="#007AFF">
    ```
    Esto asegura que la barra de herramientas del navegador (y de la PWA en modo standalone) coincida con el color primario de la aplicación.
-   **Título y Descripción:**
    -   Actualizados para reflejar el nuevo enfoque de la plataforma.

## 3. Service Worker (gestionado por `vite-plugin-pwa`)

Se ha optado por utilizar `vite-plugin-pwa` para la generación y gestión del service worker, simplificando el proceso y asegurando buenas prácticas.

-   **Instalación:** `vite-plugin-pwa` ha sido añadido como dependencia de desarrollo.
-   **Configuración (`vite.config.ts`):**
    -   El plugin se ha configurado para:
        -   **Registrar automáticamente el service worker** (`registerType: 'autoUpdate'`, `injectRegister: 'auto'`).
        -   **Generar un service worker (`generateSW`)** que utiliza Workbox.
        -   **Precachear assets estáticos:** `globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2}']` asegura que el "app shell" y otros recursos estáticos se almacenen en caché durante la instalación del service worker para cargas rápidas y disponibilidad offline básica.
        -   **Caching en Runtime:**
            -   **Fuentes de Google Fonts:** Estrategia `CacheFirst` con duración de 1 año.
            -   **Llamadas a API (que empiecen con `/api/` o al `VITE_API_URL`):** Estrategia `NetworkFirst` con fallback a caché. Los datos se cachean por 1 día. Esto permite que la app funcione con datos cacheados si está offline, pero siempre intente obtener los más recientes si hay conexión.
        -   Se **re-declara la configuración del `manifest`** dentro de las opciones del plugin para que `vite-plugin-pwa` pueda procesarlo, optimizar iconos si es necesario, y asegurar su correcta inclusión en el build.

## 4. Próximos Pasos y Pruebas

1.  **Crear Iconos Maskable:** Es **muy recomendable** generar los íconos maskable (`favicon-maskable-192x192.png` y `favicon-maskable-512x512.png`) y ubicarlos en `public/favicon/`. Herramientas como [Maskable.app](https://maskable.app/) pueden ser de ayuda.
2.  **Build de Producción:** Ejecutar `npm run build` (o el script de build correspondiente). `vite-plugin-pwa` generará el `sw.js` (service worker) y lo incluirá en el directorio de salida (usualmente `dist/`).
3.  **Pruebas en Entorno HTTPS:**
    -   Subir el contenido del directorio `dist/` a un servidor con HTTPS (es un requisito para que los service workers funcionen plenamente).
    -   **Instalación:** Probar la opción "Añadir a pantalla de inicio" o "Instalar aplicación" en navegadores compatibles (Chrome en Android, Safari en iOS, Edge en Desktop).
    -   **Manifest y Service Worker:** Usar las herramientas de desarrollador del navegador (Pestaña "Application") para verificar que el manifest se carga correctamente y que el service worker está registrado, activado y controlando la página.
    -   **Comportamiento Offline:**
        -   Tras una primera carga exitosa, desconectar la red y intentar recargar la aplicación. Debería cargar el "app shell" (la UI básica) desde el caché.
        -   Las llamadas a API que fueron cacheadas podrían mostrar datos cacheados.
    -   **Auditoría Lighthouse:** Ejecutar una auditoría de Lighthouse (en Chrome DevTools) para la categoría "Progressive Web App" y atender las recomendaciones.

## 5. Mejoras Futuras (Opcional)

Para una experiencia PWA más avanzada, se podría considerar:

-   **Estrategias de Caching más Detalladas:** Para diferentes tipos de recursos o APIs específicas.
-   **Sincronización en Segundo Plano (Background Sync):** Para permitir que acciones (como enviar un mensaje o guardar un formulario) se completen cuando se recupere la conexión si se realizaron offline.
-   **Notificaciones Push:** Para re-engagement de usuarios (requiere configuración adicional en el backend y permisos del usuario).
-   **Indicadores de Estado Offline en la UI:** Informar visualmente al usuario cuando la aplicación está operando en modo offline.

---

Esta configuración inicial sienta las bases para una PWA funcional. Es importante realizar pruebas exhaustivas y considerar las mejoras futuras para enriquecer la experiencia.
