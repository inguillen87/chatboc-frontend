# Inbox: control operativo siempre visible

Base productiva: `fefe85c028616af81b02e41d474edf861a89a8ba`.

## Problema
El detalle omnicanal ya tenía responsable, SLA y próximos pasos, pero SLA y próximos pasos estaban dentro de **Contexto, compromisos y acciones del caso**, que puede permanecer cerrado. Un operador podía comenzar a responder sin ver primero la urgencia operativa.

## Cambio
Se agrega un resumen **Control operativo del caso** siempre visible entre la cabecera y el historial:
- Responsable publicado; si no existe, muestra **Sin asignar** sin inferir una persona.
- SLA usando el componente y contrato existentes, en modo compacto.
- Primer próximo paso publicado; si no existe, muestra **Sin próximo paso publicado**.

El bloque detallado existente no se elimina: conserva los tres relojes SLA, resumen, próximos pasos completos y acciones. La franja nueva funciona como lectura inmediata, no como una segunda fuente de verdad.

## Responsive y accesibilidad
La primera versión de la franja fue rechazada por el recorrido Chromium: axe detectó contraste insuficiente en dos textos y a 320 px las tres tarjetas apiladas reducían demasiado el área de historial, haciendo que el compositor interceptara la interacción con el contexto. Se corrigió antes de commit: copy secundario eliminado, contraste simplificado y en móvil la franja es horizontal desplazable y compacta.

## Validación
- TypeScript aprobado.
- 20 pruebas focalizadas en 3 archivos, incluidas 3 nuevas sobre la franja e integración con el panel.
- La integración comprueba que responsable, SLA y próximo paso son visibles mientras el `<details>` de contexto continúa cerrado.
- Chromium del Inbox: 1440×1000, 390×844 oscuro y 320×740; los tres recorridos aprobaron después del ajuste, cero violaciones serias, una lectura de lista y una respuesta sintética por recorrido.
- El workflow `Omnichannel inbox workspace` ejecuta además suite completa y build antes de promoción.

No se modifica backend, asignación, SLA, next_steps, permisos, envío de mensajes ni datos productivos.
