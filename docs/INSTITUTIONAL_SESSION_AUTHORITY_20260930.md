# Autoridad de sesión expuesta a las pantallas institucionales

Base publicada: `01f9a79e7429c444467128bd964f8be7c0eed411`.

La comprobación real del SuperAdmin encontró que la consola de conocimiento quedaba vacía aun con una sesión válida. KnowledgeSourcesPage y TenantImplementationCenterPage consumen `hasVerifiedSession`, pero useUser sólo utilizaba el valor internamente y no lo devolvía. Las pruebas anteriores de pantalla suplían ese campo en un mock y no detectaron la incompatibilidad real.

Se devuelve la misma propiedad booleana obtenida de SessionAuthorityContext; no se deriva de un correo, un rol, localStorage o una bandera nueva. Se conservan el ocultamiento de usuario y verificación institucional al perder autoridad. No se relajan rutas, capacidades ni validación de la sesión.

Tres regresiones ejecutan useUser real y SessionAuthorityProvider real: autoridad verdadera, falsa y revocación en el mismo consumidor. Los tres casos fallaron antes del cambio. El conjunto completo, compilación y comprobación de la página productiva se registran en el PR por SHA final.

No se modifican datos de cliente, contraseñas o contenido institucional en este commit. El backend fue publicado por separado sobre su base productiva sin migraciones; la recepción y publicación de corpus requieren sus controles normales.
