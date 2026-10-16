# Entrada por dominio institucional

Esta implementación reutiliza la aplicación y el inicio público existentes. No crea una plataforma, base o landing paralela.

En un dominio propio, el primer paso es consultar de forma anónima y por el proxy del mismo origen `GET /api/public/host-resolution?host=<hostname completo>`. Sólo el contrato `public.tenant_host.v1` activo, verificado y vigente habilita el espacio. El primer segmento DNS, los scripts, la selección guardada y la organización del usuario no sustituyen esa vinculación. Un dominio pendiente, desconocido o vencido muestra un estado de indisponibilidad sin recurrir a otra organización.

Después de la vinculación, el perfil público debe coincidir en ID y slug. `/` abre el `TenantHomePage` existente; la marca, navegación y widget usan el espacio publicado. La preferencia guardada para el panel común no se modifica. Los pedidos de API pasan por el mismo origen, sin ampliar CORS. Los pedidos explícitos de otro espacio son rechazados, también si un llamador intenta omitir la selección de tenant.

La vinculación pública es presentación, no autorización. Las rutas privadas mantienen sus controles de sesión, rol y capacidades y agregan la coincidencia exacta del perfil verificado con el ID y slug del dominio. El login con correo y contraseña conserva el flujo institucional existente y verifica su resultado antes de guardar una sesión. Los mecanismos OAuth, Clerk, passkeys y sus orígenes permitidos no se amplían.

El panel de integraciones muestra el contrato `organization.domain.v1` sólo para el perfil institucional validado. Permite solicitar, consultar el TXT y desvincular con confirmación, con revisión optimista y un solo intento por operación. DNS confirmado se muestra como pendiente de publicación y HTTPS. No existe una acción cliente para activar el dominio ni se realizan cambios en su proveedor. Un cambio de sesión u organización retira las respuestas anteriores y los errores conservan la dirección escrita.

## Límites de esta entrega

- Los contratos requieren el backend de dominios correspondiente; su código no implica un dominio real activado.
- La publicación del dominio, TLS, la atestación interna y el proxy real del proveedor siguen siendo requisitos operativos independientes. No se efectuaron cambios en DNS, Vercel, OAuth ni base de producción.
- OAuth y passkeys en un dominio nuevo requieren validar explícitamente su configuración permitida. El acceso central compartido permanece disponible.
- Las pruebas locales usan identidades y dominios sintéticos; no acreditan aceptación institucional ni un recorrido autenticado en un dominio real.
