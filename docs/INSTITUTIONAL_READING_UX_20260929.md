# Lectura institucional: fuentes, preguntas y revisión sin perder contexto

Base: `2340959962f9335638ad0b99dcae0a9899eabe97`, PR #1799.
Alcance: el asistente nativo ya integrado en Implementación, Fuentes de Conocimiento y la página institucional. No es un HTML independiente ni una modificación de los textos de TDF.

## Bloque implementado

- Documentos y fuentes se abre en un diálogo del sistema visual existente, con encabezado y cierre siempre accesibles, área de lectura desplazable y foco inicial en el título. Tab permanece en el diálogo, Escape lo cierra y el foco vuelve al botón que lo abrió. El borrador y la posición de lectura del asistente no se modifican ni se dispara una consulta adicional.
- Incorporar, publicar y retirar utilizan un diálogo de revisión. Cancelar recibe el foco inicial; la interfaz identifica organización, versión y archivo seleccionado cuando corresponde. Los textos proceden del contrato backend vigente.
- La revisión bloquea las acciones de fondo, incluso una entrega programática del formulario. El archivo se prepara bajo bloqueo y una lectura tardía de otro montaje no abre una revisión nueva. No se cambia el payload, la comprobación de revisión, el intento único ni la confirmación mediante relectura.
- La pregunta permite varias líneas. Enter envía, Shift+Enter conserva un salto de línea y una composición de teclado activa no dispara una consulta accidental. Cada montaje tiene su propio ID de etiqueta, aunque dos superficies representen la misma organización.
- Una respuesta nueva coloca el título a la vista y con foco; la lectura larga puede desplazarse con teclado. Una pregunta sin cobertura y un cambio de publicación no confirmado también reciben un destino de foco visible. Los callbacks de foco de un montaje retirado se cancelan.
- Fuentes y revisión conservan tamaños táctiles, contraste de los tokens del tema, encabezado y pie separados y límites del viewport móvil. Los fragmentos y respuestas no se resumen ni se truncan para lograr el diseño.

Se reutiliza Dialog de la aplicación; no se agregan dependencias ni se modifica el componente global. Como referencia técnica se contrastó WAI-ARIA APG Dialog (Modal): foco contenido, regreso al origen y acción menos destructiva al revisar cambios. Las pruebas no sustituyen una evaluación completa con tecnologías de asistencia.

## Verificación

Las seis regresiones iniciales fallaron sobre la versión anterior. Se ampliaron a diez pruebas de foco, borrador, lectura de archivo, retiro de sesión, dos montajes y publicación incierta. El conjunto focal de conocimiento y consola aprobó 43 pruebas; TypeScript y el navegador local aprobaron.

El guion existente mantiene las rutas reales `/implementacion` y `/admin/knowledge`, apiFetch y parsers originales. HTTP, identidad y documentos son sintéticos. Añade una respuesta larga y quince fuentes para comprobar desplazamiento, diálogos de fuentes/revisión, Tab/Escape, Enter/Shift+Enter, conservación de lectura y borrador, foco de respuesta sin cobertura y denegación. Los escenarios 1440 claro, 390 oscuro y 320 claro mantienen tres intentos PUT (dos confirmados y uno denegado), no cero escrituras. No utilizan cuentas o pagos de clientes.

## Estado de entrega

La lectura pública de este turno confirmó frontend `aabfa1a6ff575014674801abf3d9a4627330dfaf` y Tierra del Fuego ID46 / tierra-del-fuego. La conexión Vercel devolvió lista vacía de equipos y 403 al listar proyectos del equipo real `team_BV1xuY6BnEzGanfok8GAyjZv`. No se intentó publicar por otra cuenta, token o ruta para eludir esa denegación.

La organización y el alta nominal de Analía constan en el seguimiento anterior, pero no se realizó ni se certificó su primer ingreso. No se recreó su cuenta, se cambió contraseña, se extrajo una sesión ni se repitió la operación de credencial bloqueada. La falta de publicación impide que esta experiencia nueva aparezca en la instalación productiva actual.

Los workflows existentes de ingreso institucional y arranque certifican el SHA final, sin cambiar permisos, límites o presupuestos. Los resultados completos y la revisión se registran en el PR una vez comprobados los artifacts. No hay un despliegue, importación de corpus ni activación de WhatsApp asociados a este incremento. Tampoco se cambió el backend ni el contenido institucional: los textos y links siguen proviniendo del contrato recibido. MuniControl fuera de alcance.
