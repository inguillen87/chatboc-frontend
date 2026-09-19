# SS-STARTUP-UX: inicio legible y Preview emparejado

Base frontend c3aff0d9 (#1749). Backend de referencia para la publicación:
df6c321d (#2784), candidato existente, cercado para escrituras. El helper de
verificación se reutiliza desde backend #2785 / 4b1223ff, sin cambios de runtime.

## Experiencia implementada

Se reemplazan las pantallas mínimas de arranque por una interfaz reutilizable
con estados comprobando servicio, espera prolongada, configuración de acceso,
sin conexión, fallo recuperable y revisión incompatible. Lenguaje de plataforma
sin nombre de cliente o marca Chatboc fija: no configura identidad empresarial.
No porcentajes inventados, pasos de negocio supuestos ni falsos estados de éxito.
Las notas explican que verificar el inicio no confirma pagos, reclamos o envíos.

Reintentar verifica el arranque sin recargar la página y no expone secretos de
las excepciones. Una referencia genérica puede comunicarse a soporte; no es un
ID de incidente ni un diagnóstico personalizado. Oculta reintento mientras hay
una comprobación pendiente. Si se pierde conexión antes de montar el producto,
se muestra ese estado; al volver se permite completar la comprobación segura.
Una página ya montada no se desmonta por cambiar la conexión: conserva la edición.
Se preserva la excepción existente de presentaciones y shell offline instalado.

Tarjeta adaptable, claro/oscuro por tokens, safe areas, foco de teclado, controles
mínimos de 44/48 px y estados anunciados sin mover el foco. Animación de actividad
honra movimiento reducido del sistema y de la aplicación. No hay nuevas librerías.

## Par real de Preview sin mover los dominios estables

El generador y el guard de rewrites antes sólo aceptaban api-preview. Ahora el
mismo flujo prebuilt admite un candidato inmutable de chatboc-backend en el equipo
conocido, siempre que se declare su SHA exacta. Conserva las ocho rutas, orden y
condiciones originales; no admite un destino externo arbitrario ni producción.
Mezclar una ruta del backend anterior, cambiar un path o quitar una condición
hace fallar el build. Sin opción nueva, el comportamiento QA previo se conserva.

```powershell
.\scripts\buildVercelPreviewQa.ps1 `
  -BackendOrigin 'https://chatboc-backend-4bnhge8na-marcelos-projects-c26aa499.vercel.app' `
  -BackendRevision 'df6c321d26aac1a27ffcfdc606ab29f177c9b8b4'
```

La revisión esperada se comprueba en el bundle. HTTP usa /api del mismo origen;
Socket.IO mantiene la conexión directa declarada. Verificar versiones no acredita
CORS/cookies/MFA/Socket.IO ni acceso institucional. La comprobación de esos canales
sigue separada. Se restauran variables temporales de build incluso ante un fallo.
El build original vercel.json no se modifica ni se habilitan escrituras del backend.
La promoción de aliases QA/producción es una acción separada, no parte del script.

## Evidencia y límites

34 regresiones nuevas: 11 de recuperación y 23 de destino/contrato de publicación.
Se mantienen las pruebas anteriores de orden de sesión y guard exacto de rutas.
Navegador: cuatro recorridos con boundary/gate/CSS reales y respuestas de API
sintéticas, en 1440/820/390 oscuro/320. Incluyen recuperación por teclado, red,
versión incompatible y mantenimiento de un borrador tras montar el contenido.
No equivalen a PWA instalada, dispositivo físico o autenticación institucional.
Las capturas de fallo/red se inspeccionaron visualmente; fallos iniciales del
harness por nombres de iconos no disponibles y ruta URL de JSDOM se corrigieron.
No se debilitaron los mocks de seguridad ni se reemplazaron asserts por capturas.

CI ejecuta suite completa, tipos, build y browser del nuevo corte. Los resultados
y verificación de candidatos se registran en el PR después de ejecutarse; esta
descripción no supone que un candidato READY ya está integrado o publicado.
La PC volvió a estar conectada y la CLI autorizada permitió retomar ese flujo.
No se modifica la API de producción, los datos de Junín o Agente Conversa,
los números/callbacks, planes, bases, DNS ni límites pagos. No elimina el 503 del
servidor ni certifica las ocho migraciones o la integración de horarios con bots.

Referencias de accesibilidad consultadas el 19/09/2026: W3C WCAG 2.2, Status Messages,
https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html .
Es un criterio aplicado al componente, no una certificación WCAG de todo el SaaS.
