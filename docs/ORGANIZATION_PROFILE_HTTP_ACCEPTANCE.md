# SS-PROFILE-ACCEPTANCE: perfil institucional probado de punta a punta

## Defectos reproducidos y corregidos

Un país institucional vacío se convertía en Argentina al abrir el perfil. Eso
creaba un cambio pendiente inexistente. Con contrato verificado se conservan
país vacío, coordenadas nulas y horas vacías exactamente como llegan del servidor;
los valores por defecto legacy no sustituyen esos datos institucionales.

Un usuario con rol principal empleado y un grant tenant_admin para su organización
podía guardar desde el backend, pero el formulario bloqueaba Guardar. La SPA real
reprodujo el botón deshabilitado. Ahora el formulario respeta can_edit del contrato
verificado para el tenant actual; no cambia roles ni habilita módulos ajenos al
permiso concedido. Una persona sin ese grant continúa en consulta y recibe 403
si intenta enviar una escritura directamente.

El motivo de consulta llega del backend: permiso requerido o mantenimiento.
Durante mantenimiento se informa que los permisos no cambiaron. Se conserva la
compatibilidad con contratos anteriores sin editability; estados contradictorios
son rechazados. También se ajusta el contraste del indicador de organización.

## Recorrido de navegador real

El runner del backend arranca una base temporal y la aplicación Flask completa;
este repositorio levanta Vite y la SPA original contra ese servidor. No se usa
route.fulfill ni un componente aislado en lugar de la página de Perfil. Se usa
el formulario de login normal y contextos independientes, sin guardar sesiones
reales en archivos. El navegador sólo permite solicitudes a loopback.

Cinco escenarios coordinados: dos administradores con conflicto y elección
explícita; lectura posterior a recarga; administrador delegado; organización
ajena aislada; empleado de consulta y rechazo de PUT. Se capturan cuatro anchos
(1440, 820, 390 oscuro y 320), se comprueba overflow y excepciones no controladas.
Los resultados del último commit se registran en el PR, no se infieren del diseño.

Desde el backend coordinado con sus dependencias instaladas:

```sh
python -m tests.run_profile_browser --frontend /ruta/a/este/repositorio
```

Además se agregan regresiones unitarias para capacidad delegada, datos vacíos
sin cambios artificiales y explicación de mantenimiento; el parser comprueba
metadatos coherentes. La suite y build generales permanecen en CI del frontend.
La prueba SPA con ambos repositorios es local; los fixtures de CI no se presentan
como prueba de extremo a extremo. Capturas locales: .vercel/profile-http-evidence.

## Publicación y pendientes

No se modifican las cuentas o WhatsApp de Junín ni el acceso de Agente Conversa.
No hay cambios en planes, credenciales, bases de clientes, dominios, callbacks,
aprobaciones de Meta/Twilio ni llamadas a proveedores. No se agregan dependencias.
Los candidatos Preview y la producción son estados distintos; publicar un candidato
no habilita por sí solo el guardado si su backend mantiene el writer fence.
Falta aceptación institucional del despliegue QA; Clerk/MFA, arranque en frío,
dispositivos físicos, PWA y consumo de horarios por los agentes siguen pendientes.
