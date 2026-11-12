# Agente Conversa: recorrido publicado y paquete interactivo

Base reconciliada: `e3b18d00d81531485dc3f4eb7980566ec5485ea0`, ya publicada por el PR #1741.
No sustituir sus 29 nodos, autenticación, credenciales ni presentación preservada por
un prototipo paralelo. Este corte extiende la misma línea y conserva todos esos avances.

## Cambios de producto

- Permite escribir el número de una opción, `menú` o `inicio`, además de pulsar botones.
  El servidor sigue validando la selección; no se convierte en un LLM libre ni acepta
  documentos o datos personales. Los errores de opción no se presentan como fallos de red.
- Exporta, tras autenticación, 29 mensajes interactivos en esquemas Meta y Twilio, con
  mapa de cada identificador al nodo/código/objetivo original. Usa exactamente la guía
  fijada por commit/hash del backend, no otro catálogo mantenido manualmente.
- Adapta cada nodo a lista o respuestas rápidas según su cantidad de opciones; comprueba
  tamaño de cuerpo, límite de opciones, unicidad de etiquetas e identificadores.
- Conserva la fuente por páginas y las propiedades de evaluación. No hay destinatario,
  número, SDK de proveedor, llamadas externas ni habilitación productiva en el generador.

## Prueba y alcance

15 pruebas Node: 10 existentes de acceso/HTTP y 5 del paquete. TypeScript, scope y build
aprobados. Cuatro recorridos HTTPS locales con API real, no interceptada: 1440, 390 oscuro,
820 y 320. Incluyen ingreso, opción escrita, fuente, derivación simulada, cierre, recarga,
logout, descarga autenticada de 29 nodos y rechazo del paquete después de salir.
No equivalen a dispositivos físicos ni a PWA instalada. La aceptación remota del nuevo
commit se registra en el PR después de publicar. No se presenta una suite completa de
frontend como ejecutada sobre este commit.

## WhatsApp: preparado no significa conectado

El paquete contiene mensajes para una ventana de servicio activa. Las listas de Twilio
no admiten aprobación como plantillas para iniciar conversaciones; para ese uso hace
falta una plantilla permitida y aprobada. Se exportan como borradores sin enviar.
Las respuestas rápidas de sesión tienen hasta tres botones; sus títulos se ajustan al
límite de 20 caracteres. Las listas tienen hasta diez opciones y títulos de 24 caracteres.
Las etiquetas abreviadas mantienen un mapa al código original para el receptor autorizado.

Antes de conectar: confirmar tenant y número/WABA, aprobación institucional de información,
consentimientos, autenticidad/idempotencia de webhooks, encaminamiento del identificador
recibido, ventana de servicio y prueba completa de recepción/entrega. No usar el perfil
Twilio activo de otra vertical como prueba de que un número pertenece a TDF.

Fuentes primarias consultadas:
- https://www.twilio.com/docs/content/twiliolist-picker
- https://www.twilio.com/docs/content/twilio-quick-reply

## Publicación acotada

Preservar el secreto, identificador y hash de acceso de la versión vigente; actualizar
únicamente EVAL_RELEASE_SHA al generar el candidato. No rotar credenciales silenciosamente.
Comprobar HTML/función, autenticación, recorrido y exportación primero en candidato;
volver a leer el alias actual antes de moverlo. Si cambió desde la baseline, no publicar.
No tocar chatboc.ar, api.chatboc.ar, Render, Neon, callbacks ni el alias histórico FARO.
Mantener el despliegue anterior para reversión. Esto publica una evaluación usable,
no declara el CRM Full o WhatsApp real del gobierno en producción.
