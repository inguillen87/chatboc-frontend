# Catálogo de preparación controlado por backend

Continúa la única línea canónica #1756, backend #2790 sin modificaciones.
Base frontend: 6712bf1e96e1ade93cea13342bb983d2902bd449.

El parser ya no exige cinco IDs, su orden o payments -> catalog codificados en React.
Acepta catálogos reducidos, reordenados, ampliados o vacíos y dependencias publicadas
por el servidor dentro del mismo contrato v1. catalog_version es un entero positivo.
Se validan hasta 100 módulos con IDs únicos y acotados, textos sin controles Unicode,
referencias existentes, ausencia de autorreferencias/ciclos y cierre de dependencias.
La selección debe seguir el orden del catálogo. Los límites de tenant, recibo,
endpoint, permiso, versión y ausencia de efectos de proveedor siguen comprobados.

Al comparar una actualización se muestran sus etiquetas actuales. Conservar un
borrador válido lo normaliza al nuevo orden antes de permitir la escritura. No se
seleccionan dependencias automáticamente ni se activan APIs, servicios o WhatsApp.

Se agregaron 22 pruebas de contrato y dos recorridos UI: capacidad nueva con
prerrequisito y guardar el borrador tras cambio de orden/etiquetas. Las 24 pasaron
localmente; también pasó la suite focal de 34 (22 nuevas + 12 anteriores).
Se corrigió una ruta del fixture antes de la reproducción válida del fallo; un
error inicial de importación no se cuenta como prueba del defecto.

Desktop Commander alcanzó su cuota durante la ejecución de suites completas.
Sus resultados finales no se pudieron recuperar. Este corte queda reconstruido
mediante GitHub y ejecuta CI de tipos, suite completa, build y navegador del perfil.
El resultado final se anota en el PR, no se infiere de esta descripción.

No publicado en Vercel ni promovido al dominio productivo por este cambio. Las
URLs de candidatos anteriores no contienen esta revisión nueva. Continúan los
gates de sesión institucional en QA, publicación coordinada y arranque en frío.
La rama productiva separada #1758 contiene recuperación compatible sin migración.
Los worktrees locales preservan cambios de continuidad adicionales todavía sin
consolidar; no sobrescribirlos ni usarlos como evidencia de despliegue.
