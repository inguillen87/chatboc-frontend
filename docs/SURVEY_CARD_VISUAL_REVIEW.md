# Revisión visual del sprint de encuestas

El primer head ac6e642 pasó 3.279 pruebas/419 archivos, TypeScript/build y cuatro
recorridos funcionales. Se descargó el artefacto real 10669575632 y se comprobó
su digest 0d78b8a2bf50b871f1d211f3366fa8b11f3bffb80943104c6e90abdc1c18f619.
Al abrir las capturas de 320 y 390 apareció un problema que esos asserts no
cubrían: el portal de confirmación aún aparecía semitransparente y animado con
prefers-reduced-motion activo. Las reglas dentro de .frame no alcanzaban el
portal, que se monta fuera de la tarjeta. No se dio esa imagen por aprobada.

La corrección añade únicamente una clase de estilo a las dos confirmaciones
existentes de SurveyCardView. El resto de la lógica y los textos se conserva.
El portal tiene superficie opaca con tokens de tema, margen del viewport, altura
acotada y scroll, controles de 44px y reglas explícitas de movimiento reducido.
No se modifica el componente global AlertDialog ni los diálogos de otros módulos.

Los cuatro recorridos ahora verifican opacity=1, ausencia de animación en el
portal, fondo opaco, botones de 44px y límites horizontal/vertical. Se repiten las
pruebas funcionales de snapshot, doble clic y cero llamadas de API del fixture.
Las capturas nuevas deben revisarse tras la CI; la prueba anterior no certifica
esta revisión. Todos los datos/callbacks siguen siendo sintéticos y no representan
cierre o borrado de encuestas reales ni autorización/idempotencia del servidor.
