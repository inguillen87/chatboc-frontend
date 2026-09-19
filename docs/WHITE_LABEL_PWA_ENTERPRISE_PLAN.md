# Chatboc: marca blanca y PWA multidispositivo

Estado: **PLANIFICADO**. Este documento define alcance y aceptación; no certifica funciones desplegadas.
Decisión de producto solicitada por Marcelo: cada municipio, gobierno o empresa debe poder operar con su identidad, dominio y experiencia adaptable, sin bifurcar el código por cliente.
Se integra al backlog full-stack, no reemplaza seguridad, pagos, encuestas ni la migración Render/Vercel/Neon.

## 1. Base revisada y brechas

Frontend revisado: `44eaf7b62cafe743c7032c3ac84fedba05288171`; backend de migración: `8b54e0114856e1ff21815a60f247bad8041d4ad4`.
- `AGENTS.md` ya exige presentación white label controlada por backend. Se conserva ese principio.
- `routes/public_resolver.py` expone contratos de tenant/widget y usa `services/tenant_resolver.py`; no crear otro resolvedor paralelo.
- `tests/test_white_label_phase0_security.py` contiene casos para dominio desconocido y tenant inactivo. Existencia de pruebas no equivale a haberlas ejecutado en este corte.
- `vite.config.ts` genera hoy un manifest global con nombre/iconos de Chatboc; eso no certifica una PWA de marca independiente por organización.
- `src/pwa.ts` desactiva el service worker en hosts efímeros `.vercel.app`; la aceptación PWA requiere un origen QA estable autorizado, no quitar ese resguardo.
- `src/pages/public/disabilityAIAgentDemo.content.ts` identifica **Faro TDF**, agente accesible para discapacidad de Tierra del Fuego, como **demostración conceptual**. Sus métricas, plazos y datos no son productivos.
- La entrada institucional de FARO excluye el manifest global. Convertir esa experiencia en marca configurable del producto compartido, no copiar su contenido demo como datos reales.

## 2. Decisiones de arquitectura

Una plataforma multi-tenant, con una línea de código por componente; separar portal/backoffice o infraestructura dedicada sólo cuando el aislamiento o un contrato lo justifique, nunca por cambiar un logo.
Mantener `tenant_id` como identidad estable: ni el nombre comercial, ni un slug, ni el dominio reemplazan la autorización del servidor.
Primera opción white label: un origen propio verificado por organización. Mantener `/t/{slug}` como ruta compatible; no prometer aislamiento de almacenamiento sólo por separar rutas del mismo origen.
El dominio propio puede seguir registrado y administrado por el cliente. No transferir dominios, delegar DNS ni comprar planes sin autorización específica.
Extender los contratos públicos existentes con un bloque tipado y versionado; validar compatibilidad antes de decidir nombres de endpoints o nuevas tablas.

## 3. WL-01: contrato de identidad y configuración (Backend + Frontend)

Modelo objetivo: `branding_version`, `display_name`, `agent_name`, logos claro/oscuro, favicon, iconos PWA, tokens de color y tipografía, identidad de soporte, URLs públicas canónicas y modo de atribución.
Reutilizar TenantProfile/configuración existente donde corresponda; documentar migración incremental y separar campos públicos de secretos de proveedores.
Accesos separados para consultar, editar, previsualizar y publicar identidad/dominios, aplicados por backend y auditados por actor/tenant.
No aceptar HTML/JavaScript/CSS arbitrarios como personalización. Validar assets, MIME, dimensiones y límites; sanitizar/rasterizar SVG y evitar carga de URLs internas o no autorizadas.
Los colores de marca no pueden anular señales semánticas de error, riesgo o éxito, ni la preferencia de accesibilidad del usuario.
**Aceptación:** contrato público sin secretos; tenant A no lee borradores ni publica cambios de B; configuración desconocida o inválida produce fallback neutro, no la marca de otro cliente.

## 4. WL-02: estudio de marca y publicación (Frontend + Backend)

Agregar Administración → Identidad y dominio: nombre, agente, logo, colores, iconos, soporte y atribución; sin inventar permisos ni habilitar módulos no contratados.
Previsualizar borrador en móvil/tablet/escritorio, claro/oscuro, con validación de contraste y assets antes de publicar.
Flujo: borrador → validación → publicación de versión → historial → restauración de una versión válida. Control de concurrencia para no sobrescribir cambios de otro administrador.
Propagar identidad a login, navegación, widget, conversación, formularios, encuestas, catálogos, pedidos, seguimiento, portal y documentos exportados cuando corresponda.
Evitar el destello inicial de la marca Chatboc en una marca blanca: resolver identidad pública antes de renderizarla; registrar todos los fallbacks globales a eliminar.
Definir atribución co-branded o marca blanca completa mediante entitlement explícito; cambiar apariencia no elimina identificación legal ni atribuciones obligatorias de terceros.
**Aceptación:** mismo build, dos organizaciones con identidad distinta; actualización sin despliegue por cliente; rollback sin mezclar cachés ni perder sesiones/borradores.

## 5. WL-03: dominios y URLs por organización (Backend + Plataforma)

Registrar dominio/subdominio, probar control DNS, validar destino y certificado TLS antes de activarlo. Estados: solicitado, pendiente de verificación, TLS pendiente, activo, suspendido, retirado.
Reservar slugs/hosts de administración; unicidad del hostname normalizado; tratar mayúsculas, IDN, puertos y conflictos de forma explícita.
Asociar `hostname → tenant_id` en servidor; aceptar cabeceras reenviadas sólo desde proxies autorizados. Un Host desconocido no obtiene el tenant por defecto.
Comprobar conflictos host/ruta/sesión; un header o un slug de otro tenant no puede cambiar silenciosamente el contexto autorizado.
Revisar cookies host-only, CSRF/Origin, CORS con orígenes exactos, CSP/frame-ancestors, login/Clerk/OAuth, Socket.IO y enlaces de restablecimiento de acceso.
Separar dominios de pruebas y producción; evitar comodines indiscriminados y redirecciones abiertas. No asumir que cookies o sesiones migran entre dominios.
Generar enlaces canónicos por tenant para encuestas, reclamos, catálogo, pedidos, pagos y portal; probar apertura desde WhatsApp y retorno de la pasarela.
Al retirar o reasignar un dominio, desactivar routing, cachés, callbacks y sesiones afectados; verificar nueva propiedad antes de asignarlo a otro cliente.
**Aceptación:** alta DNS/TLS, conflicto, dominio no verificado, baja y recuperación ensayados; ninguna navegación o respuesta sirve contenido de otro tenant.

## 6. WL-04: PWA con identidad propia (Frontend + Backend)

Manifest por organización/superficie con `id` estable, `name`, `short_name`, `start_url`, `scope`, colores e iconos maskable; `apple-touch-icon` y metadatos iniciales coherentes.
Nombre e icono instalados corresponden a la organización. No derivar la identidad de un tenant almacenado previamente en localStorage.
Preferir origen separado para instalaciones independientes; manifest/scope no es una barrera de seguridad. En rutas compartidas, diseñar explícitamente service worker, cachés, storage y navegación.
Conservar API sensible NetworkOnly. Offline inicial: shell y estado de conexión; no copiar historias, documentación de discapacidad, pagos o datos personales a caché por conveniencia.
Borradores offline y sincronización: fase posterior, opt-in según sensibilidad, TTL, aislamiento por actor/tenant, gestión de dispositivo compartido e idempotencia. No prometer cola en segundo plano universal.
Actualizar service worker sin recargar una conversación/formulario con cambios pendientes; revalidar acceso al reconectar, limpiar al salir y evitar mezcla de assets/configuración entre marcas.
Notificaciones push opt-in, detección de capacidades y alternativa dentro de la app; asociar suscripción a instalación, usuario y tenant; no revelar datos sensibles en pantalla bloqueada.
Permisos de cámara, micrófono y ubicación sólo al usarlos, con alternativa funcional si son denegados.
**Aceptación:** instalar, abrir, cerrar/reabrir, actualizar, desinstalar y reinstalar; dos marcas en un dispositivo; offline/reconexión; logout; renovación de sesión; retorno desde WhatsApp/pago.

## 7. UX-DEVICE: criterio transversal de terminado (Frontend + QA)

Todos los módulos conservan su tarea principal en teléfono, tablet y escritorio; no basta con encoger el dashboard.
- Teléfono: una tarea/panel principal; navegación lista → conversación → detalle con retorno y selección conservados; compositor por encima del teclado virtual.
- Tablet: disposición adaptada al espacio disponible, vertical/horizontal y multiventana; táctil, teclado y lápiz sin depender de hover.
- Escritorio: densidad útil, paneles redimensionables y atajos accesibles; tablas/mapas con scroll contenido donde la naturaleza del contenido lo requiera.
- Tamaños QA orientativos: 320/360/390/430, 768/820/1024 y 1280/1440/1920 CSS px; probar además altura, zoom, texto ampliado y orientación, no sólo ancho.
- Safe areas de iPhone, barras dinámicas del navegador, `dvh`, modales, foco, permisos y subida de foto/audio/archivo sin bloquear controles.
- Objetivo WCAG 2.2 AA por recorrido completo; objetivos táctiles de producto 44×44 CSS px donde sea viable, sin confundirlo con el mínimo normativo AA; texto normal 4,5:1 y controles/indicadores 3:1 cuando aplica.
- Animaciones breves no esenciales, sin parpadeos continuos; honrar movimiento reducido y alto contraste. Nunca usar sólo el color para comunicar estado.
- Reflow a 320 CSS px, zoom/texto ampliado y foco no oculto; ofrecer alternativa accesible a mapas o controles gestuales.
- Presupuesto de rendimiento por superficie y estado de red; medir LCP/INP/CLS y tamaño de shell en dispositivo objetivo. Umbrales y medición deben quedar registrados antes de certificar.
**Aceptación:** tarea completa sin pérdida de información, foco o datos; emulación de viewport no equivale a prueba de iPhone/Android físico.

## 8. Matriz de pruebas y evidencia (QA + responsables de producto)

Automatización: Chromium, Firefox y WebKit en tamaños de teléfono/tablet/escritorio, con API sintética para regresión; contratos y pruebas backend reales por separado.
Dispositivos físicos: iPhone/Safari y PWA instalada; iPad/Safari y PWA con orientación/multiventana; Android/Chrome en teléfono y tablet; desktop Chrome/Edge/Firefox y Safari macOS.
Registrar modelo, versión de SO/navegador, modo navegador/instalado, tenant/branding version, revisión frontend/backend y resultado por recorrido. Definir ventana de versiones soportadas al comenzar QA; no vender compatibilidad con todas las versiones históricas.
VoiceOver, TalkBack y teclado: lectura de estado, errores, formularios y navegación; evaluación manual además de herramientas automáticas.
Recorridos: acceso/2FA, cambio de organización, bandeja/respuesta/adjuntos, reclamo con ubicación, encuesta, catálogo/pedido, retorno de pago, portal, exportación y actualización PWA.
Estados: carga, vacío, sin permiso, error, timeout, offline, reconexión y datos antiguos; ninguna pantalla debe presentar un fallo como éxito.
Cada evidencia se marca **sintética**, **integración QA** o **dispositivo real**. Un escenario pendiente permanece pendiente; no reutilizar las capturas de bandeja como prueba de instalación PWA.

## 9. WL-05: canales, agentes y operación (Backend + Integraciones)

Cada organización configura nombre/presentación del agente, contenidos aprobados, idioma, horarios y módulos de su vertical. La marca nunca modifica permisos ni reglas de negocio.
Extender la misma identidad a enlaces de WhatsApp, Flows/webviews, encuestas, confirmaciones, email y documentos; registrar las superficies que siguen mostrando al proveedor externo.
Inventariar WABA, números, display names, plantillas, dominios de botones y aprobaciones Meta/Twilio antes de prometer el cambio. Publicar un logo web no certifica la identidad de WhatsApp.
Los dominios del checkout de terceros, permisos del navegador y plataformas externas no se sustituyen por CSS ni se ocultan mediante proxy de credenciales.
No asignar un número/proveedor de un tenant a otro, ni compartir campañas, audiencias, consentimientos o push entre organizaciones. Medir costos por tenant/canal.
**Aceptación:** mensaje autorizado → enlace de marca → entidad correcta → respuesta/pago verificado; referencias cruzadas a otro tenant rechazadas; auditoría de cambios y costos.

## 10. WL-06: piloto FARO TDF y generalización (Producto + QA)

FARO TDF se usa como caso piloto de identidad institucional: nombre, logo e iconos aprobados, agente Faro y enfoque de atención accesible. El contenido existente es conceptual y no confirma contratación ni producción.
El cliente debe confirmar dominio exacto, derecho de uso de identidad, responsable de aprobación, canales y catálogo de servicios; no se inventa ni se registra un dominio en su nombre.
No reutilizar como datos reales los casos, personas, indicadores, ventanas de atención o promesas de la demo. Aislar tenant demo y tenant operativo.
Probar una segunda organización empresarial sobre el MISMO build, con catálogo/pedidos, y otra identidad institucional cuando corresponda. Ambas deben poder coexistir sin logos, sesiones, enlaces, documentos ni suscripciones cruzados.
La aceptación FARO incluye accesibilidad y sensibilidad de documentación: sólo fixtures anonimizados en QA, sin información clínica o de discapacidad real para generar capturas.
**Aceptación:** administrador autorizado publica marca y dominio desde configuración; persona instala y usa su PWA; equipo atiende con roles reales en QA; rollback de marca y dominio ensayado.

## 11. Secuencia de implementación y ownership

| Fase | Trabajo | Responsable funcional | Gate de salida |
| --- | --- | --- | --- |
| WL-00 | Inventario y contrato; reconciliar ramas y capacidades actuales | Full-stack | Evidencia por commit, superficies y brechas |
| WL-01 | Identidad versionada, validación, permisos y API pública | Backend | Contratos y aislamiento negativo |
| WL-02 | Estudio de marca, previews y publicación/rollback | Frontend + Backend | Dos marcas sobre un build |
| WL-03 | Dominios verificados, routing, autenticación y enlaces | Plataforma + Backend | DNS/TLS y ciclo de baja seguros |
| WL-04 | Manifest/instalación/storage/actualización por organización | Frontend + Backend | Instalación real sin contaminación |
| WL-05 | Coherencia de canales y plantillas | Integraciones | Proveedores y enlaces verificados |
| WL-06 | FARO + organización empresarial, aceptación y release | QA + Producto | Matriz multidispositivo y rollback |

UX-DEVICE se aplica desde el próximo cambio de cada módulo, no se deja como retoque final. Tablet y dispositivos físicos tienen evidencia propia.
Implementar primero contrato/identidad y QA sin bloquear ensayos de migración. La activación de dominios productivos depende de release reconciliado, paridad Render/Neon, un solo escritor y rollback; no cambia esos gates.
Las ocho migraciones pendientes del plan de infraestructura no se sustituyen por este roadmap. No aplicar migraciones, mover DNS, adquirir números ni promover producción en este corte documental.
Futuro por contrato: SSO/SAML/OIDC, SCIM, infraestructura dedicada y gestión de revendedores; fuera del primer cierre white label y sin afirmar que estén disponibles.

## 12. Operación, costos y criterio comercial

Sin fork/repositorio nuevo por cliente, sin base/compute siempre activo por cambiar marca y sin rebuild para cada edición visual.
Presupuestar dominios, almacenamiento de assets, mensajes, IA, push y observabilidad por tenant; respetar planes/límites actuales y pedir aprobación para ampliaciones pagas.
Flag de activación por organización, despliegue progresivo, panel de salud de dominio/certificado y registro de quién cambió qué versión y cuándo.
La reversión de marca no reabre un dominio retirado ni restaura permisos revocados. Registrar versión de aplicación, esquema, branding y dominio separadamente.
Cierre comercial: demostrar identidad propia, instalación y circuitos funcionales; nunca vender la demo FARO ni un Preview responsive como white label productivo certificado.

## 13. Referencias técnicas consultadas

- Vercel, dominios multi-tenant y verificación: https://vercel.com/docs/platforms/multi-tenant-platforms/configuring-domains
- W3C, Web Application Manifest (`id`, `scope`, `start_url`, iconos): https://www.w3.org/TR/appmanifest/
- WebKit, Home Screen apps y Web Push en iOS/iPadOS: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- W3C, WCAG 2.2: https://www.w3.org/TR/WCAG22/

En iOS/iPadOS, diseñar el permiso push alrededor de la instalación en pantalla de inicio y la acción explícita de la persona, según WebKit; verificar comportamiento en las versiones soportadas al ejecutar QA.
No prometer APIs idénticas ni instalación automática en todos los navegadores: detección de capacidades, instrucciones específicas y alternativa usable en navegador.
