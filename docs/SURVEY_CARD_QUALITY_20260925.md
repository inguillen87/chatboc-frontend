# Encuestas: calidad de tarjetas y controles de operación

Base: `a7e2b3eb64917b2702d6bfd935d0581d5b8fafa0`, la revisión del frontend publicado observada al comenzar. Este lote no incorpora las ramas de tareas, encuestas A/B o acceso de Tierra del Fuego. No toca el backend ni la migración Render → Vercel/Neon.

## Implementado
- Las métricas ausentes se muestran como `No informado`, no como cero. Un cero explícito se conserva. Los valores negativos, no finitos, fraccionarios o no numéricos no se presentan como conteos válidos.
- Las cifras del contrato de participación tienen prioridad; una cifra explícitamente inválida no se reemplaza por un valor legacy para aparentar información disponible.
- Una cantidad con coordenadas mayor que el total de respuestas muestra `Datos no conciliados`; ya no se limita artificialmente la cobertura al 100 %. La presentación admite un decimal sin modificar la base recibida.
- Las fechas que no pueden interpretarse muestran `Fecha no verificable` en vez del texto de error de JavaScript. No se modificaron la política de zonas horarias ni los contratos de fechas.
- Los controles de la tarjeta quedan bloqueados también durante generación de datos de prueba y eliminación, además de publicación/cierre. Un bloqueo local sincrónico evita llamar dos veces al cierre o borrado mientras el callback está pendiente.
- Las confirmaciones muestran título e ID del instrumento y permanecen montadas durante la operación. Un rechazo del callback se muestra en el diálogo sin anunciar éxito; la página conserva el error de eliminación en lugar de ocultarlo.
- Botones, enlaces, búsquedas y desplegables de detalle tienen objetivos táctiles mayores; filtros de estado distribuidos en líneas, foco visible, texto de métricas sin recorte y estilos acotados a encuestas. Los diálogos contemplan movimiento reducido.

## Alcance de las garantías
El bloqueo es del componente, no idempotencia ni control de concurrencia backend. No evita una operación desde otro navegador y no certifica que un error de conexión implique que el servidor no escribió. No se añadió reintento automático.
No se cambiaron los permisos ni reglas de publicación, cierre, gobernanza, enlaces públicos o generación de datos. Las cifras proceden de los contratos existentes, sin agregar estadísticas o supuestos por municipio.

## Validación y entrega
Se añadieron 14 pruebas de presentación de métricas y 6 pruebas de controles/cierre/borrado, manteniendo los casos existentes. La comprobación focalizada ejecutó 57 pruebas en 3 archivos sin fallos. La suite completa, TypeScript y build se registran por SHA en el PR, sin reutilizar cifras de sprints anteriores.
El fixture `tests/e2e/fixtures/survey-card-workspace.html` permite revisar las tarjetas con datos y callbacks sintéticos, incluidas una eliminación rechazada y una generación en curso. No llama al backend ni representa información de clientes.
La herramienta rechazó la preparación del nuevo recorrido automatizado de navegador y del workflow dedicado; no se dio por ejecutado ninguno. La revisión visual del fixture sigue pendiente. Tampoco se aplicó el cambio de sesión/recarga inicialmente examinado en `useSurveyAdmin`: sus archivos permanecen iguales a la base. Esos pendientes no se declaran resueltos por las mejoras de tarjeta.
No se publicó esta rama en producción ni se accedió al respaldo bloqueado. No se modificaron dominios, credenciales, webhooks, bases o canales. Los ajustes quedan agrupados para revisión y publicación posterior con evidencia visual, no como una migración o activación ya realizada.

### Cierre local comprobado
La suite completa terminó con **3305 pruebas aprobadas en 413 archivos**, cero fallidas o pendientes; son 20 casos nuevos sobre la base publicada de 3285. TypeScript y `npm run build` aprobaron. Los reportes completos permanecen en `.vercel/survey-session-evidence`, fuera de Git. El lote no incorpora un workflow nuevo: no se atribuye esta ejecución local a GitHub Actions.
El diff de `src/hooks/useSurveyAdmin.ts` respecto de la base es vacío. Se verificó que las únicas modificaciones de código existente son la tarjeta, sus pruebas y el listado administrativo; los demás archivos son estilos, presentación de métricas, fixture de revisión y esta documentación.
