# Prompt · Frontend educación · auditoría readonly

```md
Trabajá SOLO en el repo chatboc-frontend.

Primero leé:
- AGENTS.md
- docs/ai/00_chatboc_codex_master.md si existe
- docs/ai/02_chatboc_frontend_codex.md si existe
- el archivo 01_MASTER_VERTICAL_EDUCACION_SAAS.md
- el archivo 03_FRONTEND_VERTICAL_EDUCACION_CODEX.md
- el archivo 08_BACKLOG_VERTICAL_EDUCACION.yaml

Fase actual: AUDITORÍA READONLY. No escribas código todavía.

Objetivo:
mapear cómo abrir la vertical educación en el frontend actual sin romper panel, widget ni contratos con backend.

Analizá y documentá:
1. cómo reutilizar el shell actual para portal familiar + panel staff
2. cómo reutilizar el widget actual para el sitio del colegio
3. cómo conservar headers y tenancy actual agregando school context
4. cómo modelar rutas, menús y permisos por rol:
   - familia
   - secretaría
   - preceptoría
   - dirección
   - administración
   - admisiones
5. cómo reutilizar la UI actual de tickets como inbox/casos escolares
6. cómo implementar student switcher y family context
7. cómo introducir campañas, asistencia, documentos y pagos sin generar caos de navegación
8. qué archivos concretos habría que tocar en una fase fundacional
9. qué riesgos de seguridad UX existen para datos de menores

Restricciones:
- no escribir código
- no proponer rewrite
- no romper contratos de headers
- no romper widget actual
- no convertir la app en dos frontends distintos
- no diseñar un ERP escolar completo
- priorizar mobile-first y role-first

Entregables:
1. mapa del frontend reutilizable
2. propuesta de arquitectura visual por rol
3. módulos críticos a tocar
4. slice plan
5. riesgos UX y seguridad
6. pruebas manuales necesarias
7. breaking changes esperados: ninguno / lista exacta

Formato de salida:
- Hallazgos
- Reutilización recomendada
- Gaps
- Archivos a tocar
- Riesgos
- Slice plan
- QA
- Breaking changes
```
