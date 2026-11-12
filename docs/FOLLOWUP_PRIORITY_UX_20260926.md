# CRM: agenda de seguimiento con prioridad operativa

Base productiva: `806898cfb7daf081114561a04b0e1e80204daa74`.

## Cambio
- La agenda de próximos contactos muestra un bloque **Atención requerida** cuando existen seguimientos vencidos, para hoy o con fecha no verificable.
- El operador puede saltar directamente a **Ver vencidos**, **Ver hoy** o **Revisar fechas** sin volver a consultar el backend.
- Los conteos siguen calculándose únicamente sobre los contactos efectivamente recibidos y verificados; no se presentan como universo histórico.
- Cuando una búsqueda/prioridad deja cero resultados, aparece **Limpiar búsqueda y prioridad** para recuperar la agenda en un clic sin una nueva petición.
- No se cambió persistencia, contratos, identidad de tenant, edición del seguimiento ni semántica de fechas.

## Validación
- TypeScript aprobado.
- 55 pruebas focalizadas aprobadas en 4 archivos; 2 pruebas nuevas cubren salto a vencidos y recuperación de filtros vacíos.
- El salto de prioridad y el reset de filtros no generan una nueva consulta.
- Chromium del flujo real de follow-up con transporte/persistencia sintéticos aprobó en 1440×1000, 390×844 oscuro y 320×740: una escritura verificada por recorrido, cero violaciones serias, persistencia tras recarga y bloqueo de conflicto preflight.
- El workflow `CRM persistent follow-up` ejecuta además la suite completa y build antes de promoción.

No se modificaron contactos productivos durante estas pruebas.
