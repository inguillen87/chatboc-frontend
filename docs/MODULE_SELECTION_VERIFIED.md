# Selección de preparación por organización

Base: frontend 4f8d0eba y backend 03b21c46. Rama aislada de edición simultánea;
no sustituye otro worktree ni promueve dominios de producción.

Dentro del centro de implementación, un administrador puede abrir la selección
de funciones. El catálogo, dependencias y todos los textos vienen del backend.
Se muestran catálogo, pagos/pedidos, WhatsApp, encuestas y territorio cuando aplica.
El servidor exige Full y permiso de administración para guardar. La selección
sólo cambia los pasos de preparación, nunca permisos o integraciones operativas.

El editor conserva borrador, muestra una comparación antes de confirmar y valida
el recibo exacto de persistencia. Cobros necesita catálogo; no deja quitar una
dependencia mientras esté seleccionada la función que la necesita. Descartar exige
confirmación y no hace PUT. Ante conflicto o respuesta incierta no repite la
escritura: requiere relectura y elección explícita. Otra organización no puede
reutilizar la selección anterior; al revocar acceso se retira el editor.

Se usa el aviso nativo de cierre sólo mientras hay edición o revisión pendiente.
No hay autosave, persistencia offline ni garantía universal del diálogo nativo.
Las vistas contemplan teléfono, tablet, escritorio, teclado, contraste y movimiento
reducido. El selector se carga al abrir su sección, sin repetir consultas de alta.

Validación: 11 regresiones nuevas frontend, 15 backend (una carrera PostgreSQL),
tres escenarios HTTP de aplicación completa y un recorrido nuevo de SPA con
persistencia tras recarga y capturas 1440/820/390 oscuro/320. Los resultados de
cada ejecución quedan en el PR. Son cuentas y bases desechables; la prueba local
no equivale a sesión institucional en Vercel, MFA, WhatsApp o PWA física.
