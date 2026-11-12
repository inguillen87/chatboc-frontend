# Inventario de capacidades de septiembre frente a integración actual

**Fecha:** 12 de noviembre de 2026. **Objeto:** insumo para que Claude decida recuperaciones selectivas. **Alcance:** lectura de código, contratos, pruebas y grafo Git; ningún cambio de producto ni publicación.

**La línea principal evaluada es la integración `claude/integration-20261112` congelada en `2055b560`; este documento no evalúa `main` ni certifica lo desplegado en producción.**

## Decisión recomendada

**No fusionar la rama de septiembre completa.** Sus 46 commits exclusivos contienen capacidades valiosas, correcciones ya recuperadas, implementaciones superadas y una demo retirada. La comparación identifica **18 capacidades: 1 equivalente adaptada, 9 parciales, 7 que faltan en el alcance concreto descrito y 1 obsoleta operativamente con fuente conservada**. Estos conteos clasifican capacidades, no porcentajes del producto.

La primera revisión propuesta es **C09, confirmación de pago**: una ruta activa todavía puede derivar “Pago aprobado” del parámetro `status` de la URL. Luego conviene recuperar garantías de autoridad/recibo de WhatsApp (C08), snapshot y conciliación de encuestas (C11), categorías acotadas por tenant (C10) y la lectura canónica de comparación A/B/cobertura (C15/C14). Las pantallas de branding, módulos y metodología requieren decisiones de producto y, en metodología, comprobación de almacenamiento y flag.

La funcionalidad actual de identidad institucional, aislamiento de sesión, gobernanza de encuestas, jurisdicción, asistente y ciclos modernos de pedidos debe preservarse. La corrección **0,5 → 0,5 %** ya está recuperada; no es un pendiente. Los controles de readiness también tienen caducidad actual. El código de evaluación está preservado; la decisión comunicada de retirar su antigua demo sigue vigente.

## 1. Snapshots y método reproducible

| Referencia | Repositorio / revisión exacta | Uso |
| --- | --- | --- |
| **A — integración actual** | `inguillen87/chatboc-frontend` · `2055b560616f93d2b3c3eaadc13d4966f0a5f045` | Snapshot de `claude/integration-20261112`; no es una comparación con `main` o con el sitio en producción. |
| **S — septiembre** | `inguillen87/chatboc-frontend` · `714f8811ebceb2965e3c3b4e094bc335b8a89c78` | `origin/feat/organization-access-20260923`. |
| **M — ancestro común** | `inguillen87/chatboc-frontend` · `9d85b481b026484dec0042b0b4193aac8c734e31` | Diferencia neta de septiembre. |
| **B — backend actual** | `inguillen87/chatbot-backend` · `d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1` | Contratos y dependencias del consumidor actual. |

Se leyeron `AGENTS.md` de ambos repositorios; no hay instrucciones anidadas adicionales. Se inspeccionaron los 46 commits exclusivos, el diff neto M→S y los consumidores actuales, siguiendo montajes/rutas y contratos de backend donde la coincidencia de nombres podía engañar. La evidencia de “falta” combina ausencia de consumidor equivalente con un recorrido actual que no cumple ese comportamiento; no se equipara archivo ausente con funcionalidad perdida.

```bash
git log --reverse --format='%H %P %ad %s' --date=short 2055b560616f93d2b3c3eaadc13d4966f0a5f045..714f8811ebceb2965e3c3b4e094bc335b8a89c78
git diff --name-status 9d85b481b026484dec0042b0b4193aac8c734e31 714f8811ebceb2965e3c3b4e094bc335b8a89c78
git merge-tree --write-tree --name-only --no-messages 2055b560616f93d2b3c3eaadc13d4966f0a5f045 714f8811ebceb2965e3c3b4e094bc335b8a89c78
```

`merge-tree` simula la combinación y escribe un objeto Git; **no modifica checkout, index, rama ni archivos del producto**. Su salida de conflicto fue 1, con árbol `09afa1d5a20dcd323b21adec9b692a7a5acd17a7` y 31 rutas conflictivas. Es una evaluación textual: que un archivo no produzca conflicto no acredita compatibilidad de contratos o comportamiento.

| Medida | Resultado | Qué significa |
| --- | ---: | --- |
| Commits alcanzables desde S y no desde A | 46 | Incluye 4 merges y 42 commits de un padre; no son 46 funcionalidades independientes. |
| Rutas cambiadas M→S | 292 | 235 altas y 57 modificaciones. |
| Altas de septiembre presentes en A | 26 de 235 | Sólo coincidencia de ruta; el resto puede tener otra implementación. |
| Altas con blob idéntico S/A | 19 | 17 archivos de evaluación y 2 fixtures de organización. |
| Altas presentes con contenido diferente | 7 | Login y guía privada; se analizaron como capacidades adaptadas. |
| Conflictos del merge simulado | 31 | Inventario completo en el apéndice B. |

El archivo acompañante [SEPTEMBER_FEATURE_INVENTORY_20261112.json](SEPTEMBER_FEATURE_INVENTORY_20261112.json) conserva las 292 rutas, estado de blob, 46 commits con sus rutas cambiadas, clasificación por capacidad y conflictos. Las listas de archivos de merges se dejan vacías expresamente: son commits de integración y su resultado se considera en el diff neto, no como 4 nuevas capacidades.

### Significado de la clasificación

- **Equivalente adaptado:** comportamiento principal disponible en otra implementación o en una versión extendida, según lectura de código y pruebas.
- **Parcial:** una parte relevante existe; se identifica el comportamiento que falta o difiere.
- **Falta capacidad:** falta la garantía o recorrido concreto definido en la fila. No significa que todo ese módulo del producto esté ausente.
- **Obsoleto operativo; fuente conservada:** existe código de referencia pero la decisión vigente es no reactivar su publicación.

**Pruebas citadas:** se inspeccionaron selectivamente los casos relevantes para las diferencias descritas; también se señalan suites relacionadas como referencia de recuperación. **No se ejecutaron suites de aplicación ni se trasladan aquí los resultados de aceptación históricos.** La validación efectuada para este entregable es de trazabilidad Git y de existencia de fuentes/enlaces. Los links S/A/B de abajo fijan la revisión exacta.

## 2. Matriz de capacidades

| ID | Capacidad | Clasificación | Orden sugerido |
| --- | --- | --- | --- |
| C01 | Acceso institucional, identidad privada y guía por organización | Equivalente adaptado | Conservar |
| C02 | Perfil institucional por vertical y edición concurrente | Parcial | P2 |
| C03 | Estudio de paleta institucional con publicación y restauración | Falta capacidad | P2 |
| C04 | Preparación guiada y workspace enfocado por etapas | Parcial | P2 |
| C05 | Selección de módulos con catálogo y dependencias del backend | Falta capacidad | P2 |
| C06 | Readiness con caducidad, recuperación de arranque y reconexión | Parcial | P1 |
| C07 | Alta de WhatsApp preservando conexiones existentes | Parcial | P1 |
| C08 | Packs de WhatsApp, recibos e identidad del borrador incierto | Parcial | P1 |
| C09 | Confirmación de pago verificada y recuperación acotada del pedido | Falta capacidad | P0 |
| C10 | Foco de bandeja, categorías por tenant y SLA compacto | Parcial | P1/P2 |
| C11 | Confirmación destructiva de encuestas y conciliación del workspace | Parcial | P1 |
| C12 | Evidencia de analytics y unidad de completitud | Parcial | P1/P2 |
| C13 | Ficha metodológica versionada de encuestas | Falta capacidad | P2 con gate backend |
| C14 | Cobertura de campo y filtros demográficos/territoriales canónicos | Falta capacidad | P1 |
| C15 | Comparación A/B con bases y diferencias en puntos porcentuales | Falta capacidad | P1 |
| C16 | Navegación documental /admin en desarrollo sin interceptar APIs | Falta capacidad | P1 para QA local |
| C17 | Demo aislada de evaluación y exportación de menú/pack | Obsoleto operativo; fuente conservada | No reactivar |
| C18 | Política de previews y publicación emparejada de revisiones | Parcial | P1 coordinación |

## 3. Evidencia y diferencias por capacidad

### C01 — Acceso institucional, identidad privada y guía por organización

**Equivalente adaptado. El flujo principal está recuperado y extendido. La ausencia del viejo workspace no implica perder login ni guía.**

**En septiembre:** Separaba `/login` global del acceso explícito `/t/:slug/login`; no reutilizaba una visita pública como autoridad. Mostraba nombre, tipo y logo del perfil autenticado. La guía privada se descubría desde activación, se leía bajo demanda y verificaba alcance y fuente.

**En A:** `panelLogin`, `panelLoginScope` y `panelLoginSession` existen con validación de respuesta y revisión de sesión. `useUser` distingue perfil verificado; `PrivateWorkspaceBrand` y la presentación privada evitan usar identidad pública como identidad administrativa. `PrivateConversationGuide` conserva lectura diferida y control de respuestas tardías; `PrivateGuideControl` agrega administración y lectura posterior. El centro actual monta además `InstitutionalAssistant`.

**Diferencia concreta:** No se detectó una capacidad principal perdida en este bloque. No se afirma igualdad línea por línea: el acceso actual agrega continuidad de sesión y contratos posteriores. La guía privada de evaluación y el asistente institucional publicado son recorridos distintos.

**Decisión propuesta:** Conservar la implementación actual. Usar las regresiones históricas sólo para contrastar casos no cubiertos; no reemplazar auth, Navbar ni useUser por la rama antigua.

**Dependencia backend:** Login y perfil privado autenticados; descriptor `conversation_guide`/`organization_setup.conversation_guide` y control privado. La disponibilidad real depende de permisos/configuración del tenant.

**Fuentes S:** [src/api/panelLogin.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/api/panelLogin.ts); [src/utils/panelLoginScope.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/utils/panelLoginScope.ts); [src/components/implementation/PrivateConversationGuide.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/components/implementation/PrivateConversationGuide.tsx); [src/utils/privateConversationGuide.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/utils/privateConversationGuide.ts).

**Fuentes A:** [src/api/panelLogin.ts](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/api/panelLogin.ts); [src/utils/panelLoginSession.ts](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/utils/panelLoginSession.ts); [src/hooks/usePrivateWorkspacePresentation.ts](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/hooks/usePrivateWorkspacePresentation.ts); [src/components/brand/PrivateWorkspaceBrand.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/brand/PrivateWorkspaceBrand.tsx); [src/components/implementation/PrivateConversationGuide.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/implementation/PrivateConversationGuide.tsx); [src/components/implementation/PrivateGuideControl.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/implementation/PrivateGuideControl.tsx); [src/pages/TenantImplementationCenterPage.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/pages/TenantImplementationCenterPage.tsx).

**Pruebas de referencia S:** [src/api/panelLogin.test.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/api/panelLogin.test.ts); [src/utils/privateConversationGuide.test.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/utils/privateConversationGuide.test.ts); [src/components/implementation/PrivateConversationGuide.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/components/implementation/PrivateConversationGuide.test.tsx).

**Pruebas de referencia A / recorridos relacionados:** [src/api/panelLogin.test.ts](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/api/panelLogin.test.ts); [src/utils/privateWorkspaceIdentity.test.ts](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/utils/privateWorkspaceIdentity.test.ts); [src/components/implementation/PrivateConversationGuide.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/implementation/PrivateConversationGuide.test.tsx); [src/components/implementation/PrivateGuideControl.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/implementation/PrivateGuideControl.test.tsx); [src/pages/Perfil.institutionSession.causal.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/pages/Perfil.institutionSession.causal.test.tsx).

**Fuentes/pruebas B:** [routes/admin_tenant.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/routes/admin_tenant.py); [services/channel_activation.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/services/channel_activation.py); [services/tenant_conversation_guide_control.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/services/tenant_conversation_guide_control.py); [tests/private_conversation_guide_http.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/tests/private_conversation_guide_http.py)

**Conflictos textuales relacionados:** `src/api/panelLogin.ts`, `src/api/panelLogin.test.ts`, `src/utils/panelLoginScope.ts`, `src/utils/panelLoginSession.ts`, `src/pages/Login.tsx`, `src/hooks/useUser.tsx`, `src/hooks/useUser.test.tsx`, `src/components/implementation/PrivateConversationGuide.tsx`, `src/components/implementation/PrivateConversationGuide.test.tsx`, `src/utils/privateConversationGuide.ts`, `src/utils/privateConversationGuide.test.ts`, `src/components/layout/Navbar.tsx`, `src/components/layout/Navbar.test.tsx`

### C02 — Perfil institucional por vertical y edición concurrente

**Parcial. Se conservaron edición acotada, revisión esperada y retención ante conflicto; falta la revisión explícita de diferencias entre versiones.**

**En septiembre:** Workspace responsivo según tipo institucional, campos compartidos, guardado con revisión y recibo, borrador preservado ante incertidumbre. `ProfileVersionReview` permitía comparar versión publicada y borrador, resolver campos y tratar coordenadas como par.

**En A:** `InstitutionProfileWorkspace` mantiene secciones y selector móvil. `Perfil.handleGuardar` usa `/api/admin/tenants/:slug/config`, `expected_revision`, cambios por campo, `singleAttempt`, alcance de sesión y lectura posterior de la revisión. Un 412 conserva el borrador; hay pruebas actuales específicas. El campo de encabezado de recibo de WhatsApp agrega comprobación de eco exacto.

**Diferencia concreta:** No hay equivalente encontrado al comparador `ProfileVersionReview` ni a la resolución campo por campo. El mensaje de conflicto dirige a actualizar el perfil; preservar el borrador hasta ese momento no equivale a ofrecer conciliación visual. El guardado actual no debe describirse como un PUT personal inseguro: está expresamente acotado.

**Decisión propuesta:** Recuperar, si se necesita, sólo la experiencia de comparación y descarte sobre el guardado actual. Preservar campos nuevos y sus recibos; revisar coherencia de eco/revisión para todos los campos antes de afirmar equivalencia completa.

**Dependencia backend:** `organization.profile_settings.v1`/`organization.profile_save.v1`, permiso administrativo y concurrencia del backend ya existen. Las escrituras respetan los bloqueos actuales del servidor.

**Fuentes S:** [src/components/profile/InstitutionProfileWorkspace.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/components/profile/InstitutionProfileWorkspace.tsx); [src/hooks/useOrganizationProfileSave.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/hooks/useOrganizationProfileSave.ts); [src/components/profile/ProfileVersionReview.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/components/profile/ProfileVersionReview.tsx); [src/utils/organizationProfileSettings.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/utils/organizationProfileSettings.ts).

**Fuentes A:** [src/components/profile/InstitutionProfileWorkspace.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/profile/InstitutionProfileWorkspace.tsx); [src/pages/Perfil.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/pages/Perfil.tsx).

**Pruebas de referencia S:** [src/hooks/useOrganizationProfileSave.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/hooks/useOrganizationProfileSave.test.tsx); [src/components/profile/ProfileVersionReview.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/components/profile/ProfileVersionReview.test.tsx); [src/utils/organizationProfileSettings.test.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/utils/organizationProfileSettings.test.ts).

**Pruebas de referencia A / recorridos relacionados:** [src/pages/Perfil.requestLifecycle.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/pages/Perfil.requestLifecycle.test.tsx); [src/components/profile/InstitutionProfileWorkspace.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/profile/InstitutionProfileWorkspace.test.tsx).

**Fuentes/pruebas B:** [routes/admin_tenant.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/routes/admin_tenant.py); [services/organization_profile_settings.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/services/organization_profile_settings.py); [tests/test_organization_profile_settings.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/tests/test_organization_profile_settings.py); [tests/test_organization_receipt_header_settings.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/tests/test_organization_receipt_header_settings.py)

**Conflictos textuales relacionados:** `src/components/profile/InstitutionProfileWorkspace.tsx`, `src/pages/Perfil.tsx`, `src/pages/Perfil.requestLifecycle.test.tsx`, `src/hooks/useUser.tsx`

### C03 — Estudio de paleta institucional con publicación y restauración

**Falta capacidad. El estudio versionado de la paleta del workspace no tiene consumidor actual equivalente; hay otros sistemas de marca que no lo sustituyen.**

**En septiembre:** `OrganizationBrandStudio` ofrecía presets del backend, vista previa local clara/oscura y móvil/escritorio, publicación confirmada, comparación exacta de valores, historial y restauración. Los textos y acciones se validaban desde el contrato `workflow_ui`, incluidos controles Unicode.

**En A:** Existen identidad institucional, edición de logo, `ChatCustomizer` para apariencia del widget, branding del bot y proyección de colores del dominio. Se buscaron consumidores de `organization_branding`, `workspace_appearance`, historial, publicación y restauración; esos recorridos no implementan el estudio privado de septiembre.

**Diferencia concreta:** Faltan el editor, la vista previa y la restauración del contrato `organization.branding.v1` dentro de perfil/preparación. La existencia de un selector de color para el widget o del logo no acredita esa funcionalidad.

**Decisión propuesta:** Recuperación selectiva sobre las superficies actuales; confirmar primero si se quiere aplicar a perfil/implementación o ampliar su alcance. No trasladar CSS global ni cambiar condiciones comerciales desde el frontend.

**Dependencia backend:** El GET de config ya entrega `organization_branding` y el PUT acepta esa clave. `organization_branding.py` conserva revisión, historial máximo 10 y operaciones publish/restore; `workspace_appearance` se proyecta en activación. La elegibilidad la decide `plan_access.py` (Full explícito y tenant activo/no demo en este snapshot).

**Fuentes S:** [src/components/profile/OrganizationBrandStudio.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/components/profile/OrganizationBrandStudio.tsx); [src/components/profile/BrandComparison.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/components/profile/BrandComparison.tsx); [src/hooks/useBrandStudio.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/hooks/useBrandStudio.ts); [src/utils/workspaceBranding.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/utils/workspaceBranding.ts); [src/utils/brandWorkflowUI.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/utils/brandWorkflowUI.ts).

**Fuentes A:** [src/pages/Integracion.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/pages/Integracion.tsx); [src/components/admin/ChatCustomizer.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/admin/ChatCustomizer.tsx); [src/utils/chatCustomizerPersistence.ts](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/utils/chatCustomizerPersistence.ts); [src/pages/BotSettingsEnterprise.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/pages/BotSettingsEnterprise.tsx); [src/utils/tenantHostBinding.ts](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/utils/tenantHostBinding.ts).

**Pruebas de referencia S:** [src/components/profile/OrganizationBrandStudio.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/components/profile/OrganizationBrandStudio.test.tsx); [src/components/profile/OrganizationBrandContinuity.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/components/profile/OrganizationBrandContinuity.test.tsx); [src/components/profile/OrganizationBrandCopy.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/components/profile/OrganizationBrandCopy.test.tsx); [src/utils/workspaceBranding.test.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/utils/workspaceBranding.test.ts).

**Pruebas de referencia A / recorridos relacionados:** [src/utils/chatCustomizerPersistence.test.ts](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/utils/chatCustomizerPersistence.test.ts); [src/utils/privateWorkspaceIdentity.test.ts](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/utils/privateWorkspaceIdentity.test.ts).

**Fuentes/pruebas B:** [routes/admin_tenant.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/routes/admin_tenant.py); [services/organization_branding.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/services/organization_branding.py); [services/organization_branding_ui.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/services/organization_branding_ui.py); [services/plan_access.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/services/plan_access.py); [tests/test_organization_branding.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/tests/test_organization_branding.py); [tests/test_organization_branding_ui.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/tests/test_organization_branding_ui.py)

**Conflictos textuales relacionados:** `src/components/profile/InstitutionProfileWorkspace.tsx`, `src/pages/Perfil.tsx`, `src/components/layout/Navbar.tsx`, `src/pages/TenantImplementationCenterPage.tsx`

### C04 — Preparación guiada y workspace enfocado por etapas

**Parcial. El centro de implementación funciona en el código actual; falta la proyección enfocada de preparación por vertical.**

**En septiembre:** `SetupPreparationGuide` explicaba preparación sin jerga. `OrganizationSetupWorkspace` consumía la proyección `organization_setup`, permitía concentrarse en una etapa y preservaba navegación/borradores sin disparar escrituras. Un contrato presente pero inválido no autorizaba una vuelta al flujo genérico.

**En A:** `TenantImplementationCenterPage` tiene tenant y sesión explícitos; monta readiness, blueprint, guía/asistente, `ChannelActivationChecklist` y paneles gubernamentales nuevos. `TenantLaunchJourney` conserva su recorrido de activación. El campo `organization_setup?: unknown` existe en tipos, pero no se consume como workspace de etapas.

**Diferencia concreta:** Falta la presentación enfocada, vertical y opcional de `tenant.implementation_journey.v2`; no falta toda la preparación. Provisionar un blueprint y navegar la preparación del cliente tienen efectos y propósitos distintos.

**Decisión propuesta:** Diseñar la incorporación al centro actual, conservando jurisdicción, Mesa Única, asistente y estados de aprovisionamiento. Hacerlo después de decidir módulos y branding para evitar dos workspaces concurrentes.

**Dependencia backend:** `services/organization_setup_journey.py` construye etapas, módulos elegidos, apariencia y guía dentro de channel_activation. Validar su contrato actual completo antes de reutilizar el parser histórico.

**Fuentes S:** [src/components/implementation/SetupPreparationGuide.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/components/implementation/SetupPreparationGuide.tsx); [src/components/implementation/OrganizationSetupWorkspace.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/components/implementation/OrganizationSetupWorkspace.tsx); [src/utils/organizationSetupJourney.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/utils/organizationSetupJourney.ts).

**Fuentes A:** [src/pages/TenantImplementationCenterPage.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/pages/TenantImplementationCenterPage.tsx); [src/components/implementation/TenantLaunchJourney.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/implementation/TenantLaunchJourney.tsx); [src/components/profile/ChannelActivationChecklist.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/profile/ChannelActivationChecklist.tsx); [src/api/v2/channelActivation.ts](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/api/v2/channelActivation.ts).

**Pruebas de referencia S:** [src/components/implementation/SetupPreparationGuide.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/components/implementation/SetupPreparationGuide.test.tsx); [src/components/implementation/OrganizationSetupWorkspace.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/components/implementation/OrganizationSetupWorkspace.test.tsx); [src/utils/organizationSetupJourney.test.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/utils/organizationSetupJourney.test.ts).

**Pruebas de referencia A / recorridos relacionados:** [src/pages/TenantImplementationCenterPage.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/pages/TenantImplementationCenterPage.test.tsx); [src/components/implementation/TenantLaunchJourney.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/implementation/TenantLaunchJourney.test.tsx); [src/components/implementation/TenantProvisioningReadinessPanel.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/implementation/TenantProvisioningReadinessPanel.test.tsx).

**Fuentes/pruebas B:** [services/organization_setup_journey.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/services/organization_setup_journey.py); [services/channel_activation.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/services/channel_activation.py); [tests/test_organization_setup_journey.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/tests/test_organization_setup_journey.py); [tests/profile_http_acceptance.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/tests/profile_http_acceptance.py)

**Conflictos textuales relacionados:** `src/api/v2/channelActivation.ts`, `src/components/profile/ChannelActivationChecklist.tsx`, `src/pages/TenantImplementationCenterPage.tsx`, `src/components/layout/Layout.tsx`, `src/components/layout/Layout.test.tsx`

### C05 — Selección de módulos con catálogo y dependencias del backend

**Falta capacidad. No se encontró un editor equivalente del borrador de preparación de módulos; permisos y blueprint no cumplen esa función.**

**En septiembre:** `OrganizationModuleSelector` y `ModuleSelectionGrid` presentaban catálogo dinámico, cambios pendientes y confirmación. `selection_assistance` explicaba altas/bajas transitivas antes de aplicar al borrador. Se preservaba el borrador al contraer la sección y se rechazaban catálogos incoherentes.

**En A:** El centro tiene blueprint, readiness y capacidades de módulos. `TenantModal` y el onboarding general gestionan organización; no consumen `organization_modules` ni `selection_assistance` para revisar/guardar una selección con versión. No se usa el nombre del componente como única evidencia de ausencia.

**Diferencia concreta:** Faltan selección/confirmación/revisión de dependencias y lectura posterior de `organization.setup_modules.v1` en el frontend actual.

**Decisión propuesta:** Acordar la necesidad comercial y luego integrar el selector al centro vigente. El frontend debe usar catálogo, dependencias y permisos del servidor; no reconstruir la política con una lista fija.

**Dependencia backend:** GET/PUT `/api/admin/tenants/:slug/config` ya implementan `organization_modules`; `organization_modules.py` contiene catálogo, revisión, ayuda y recibo `organization.setup_modules_save.v1`. Declara `changes_runtime_access: false`: organiza preparación, no cambia permisos ni habilita servicios. Comparte elegibilidad Full con branding en B; no confundir con los tres niveles de dominios que se implementan aparte.

**Fuentes S:** [src/components/implementation/OrganizationModuleSelector.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/components/implementation/OrganizationModuleSelector.tsx); [src/components/implementation/ModuleSelectionGrid.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/components/implementation/ModuleSelectionGrid.tsx); [src/hooks/useModuleSelection.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/hooks/useModuleSelection.ts); [src/utils/moduleCatalog.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/utils/moduleCatalog.ts); [src/utils/moduleSelectionAssistance.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/utils/moduleSelectionAssistance.ts).

**Fuentes A:** [src/components/implementation/TenantBlueprintProvisioningPanel.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/implementation/TenantBlueprintProvisioningPanel.tsx); [src/components/implementation/TenantProvisioningReadinessPanel.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/implementation/TenantProvisioningReadinessPanel.tsx); [src/components/admin/TenantModal.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/admin/TenantModal.tsx); [src/pages/TenantImplementationCenterPage.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/pages/TenantImplementationCenterPage.tsx).

**Pruebas de referencia S:** [src/components/implementation/OrganizationModuleSelector.catalog.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/components/implementation/OrganizationModuleSelector.catalog.test.tsx); [src/components/implementation/OrganizationModuleSelector.assistance.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/components/implementation/OrganizationModuleSelector.assistance.test.tsx); [src/utils/organizationModules.dynamic.test.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/utils/organizationModules.dynamic.test.ts); [src/utils/moduleSelectionAssistance.test.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/utils/moduleSelectionAssistance.test.ts).

**Pruebas de referencia A / recorridos relacionados:** [src/components/implementation/TenantProvisioningReadinessPanel.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/implementation/TenantProvisioningReadinessPanel.test.tsx).

**Fuentes/pruebas B:** [routes/admin_tenant.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/routes/admin_tenant.py); [services/organization_modules.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/services/organization_modules.py); [services/plan_access.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/services/plan_access.py); [tests/test_organization_modules.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/tests/test_organization_modules.py); [tests/profile_http_acceptance.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/tests/profile_http_acceptance.py)

**Conflictos textuales relacionados:** `src/pages/Perfil.tsx`, `src/components/profile/InstitutionProfileWorkspace.tsx`, `src/pages/TenantImplementationCenterPage.tsx`, `src/api/v2/channelActivation.ts`

### C06 — Readiness con caducidad, recuperación de arranque y reconexión

**Parcial. La caducidad y los límites de espera están recuperados; el emparejamiento por SHA y la experiencia completa de recuperación no.**

**En septiembre:** Lease temporal de readiness, comparación con revisión backend declarada, arranque recuperable y barra de reconexión accesible bajo el header. Tras arrancar, mantenía formularios montados ante cortes, sin repetir escrituras ni convertir una observación vieja en disponibilidad actual.

**En A:** `backendBootstrapGate` agrupa consultas por URL, usa lease de 30 s y plazo acotado de 30 s, limita intentos y sólo reintenta el 503 explícito de inicialización. `api.startupContinuity` agrega protección de continuidad. `AppShellStatusBar` informa offline mediante `useNetworkStatus`.

**Diferencia concreta:** El probe valida presencia de versión, pero no compara una revisión esperada. No se encontró equivalente completo a `StartupRecovery`/`useRuntimeRecovery` con recuperación visible y conservación del workspace después del arranque. La infraestructura de solicitudes actual es distinta: no inferir que sus protecciones faltan por no existir `backendReadinessLease.ts`.

**Decisión propuesta:** Añadir únicamente los casos faltantes a la continuidad vigente. Coordinar la revisión esperada con el flujo de publicación de C18; comprobar cortes con formularios abiertos y evitar repetición de POST/PUT.

**Dependencia backend:** Depende de `/api/version` y de distinguir readiness técnico de revisión desplegada. No se midió una respuesta real del entorno ni se fijó un SHA en producción en esta tarea.

**Fuentes S:** [src/utils/backendReadinessLease.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/utils/backendReadinessLease.ts); [src/utils/backendBootstrapGate.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/utils/backendBootstrapGate.ts); [src/components/app-shell/StartupRecovery.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/components/app-shell/StartupRecovery.tsx); [src/hooks/useRuntimeRecovery.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/hooks/useRuntimeRecovery.ts); [src/components/app-shell/AppShellStatusBar.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/components/app-shell/AppShellStatusBar.tsx).

**Fuentes A:** [src/utils/backendBootstrapGate.ts](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/utils/backendBootstrapGate.ts); [src/components/app-shell/AppShellStatusBar.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/app-shell/AppShellStatusBar.tsx); [src/App.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/App.tsx).

**Pruebas de referencia S:** [src/utils/backendReadinessLease.test.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/utils/backendReadinessLease.test.ts); [src/utils/backendBootstrapGate.release.test.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/utils/backendBootstrapGate.release.test.ts); [tests/runtime-recovery.browser.mjs](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/tests/runtime-recovery.browser.mjs); [tests/runtime-resume.browser.mjs](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/tests/runtime-resume.browser.mjs).

**Pruebas de referencia A / recorridos relacionados:** [src/utils/backendBootstrapGate.test.ts](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/utils/backendBootstrapGate.test.ts); [src/utils/api.startupContinuity.test.ts](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/utils/api.startupContinuity.test.ts); [src/App.session-bootstrap.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/App.session-bootstrap.test.tsx).

**Fuentes/pruebas B:** [routes/config.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/routes/config.py); [routes/health/__init__.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/routes/health/__init__.py)

**Conflictos textuales relacionados:** `src/utils/backendBootstrapGate.ts`, `src/components/layout/Navbar.tsx`, `src/components/layout/Layout.tsx`

### C07 — Alta de WhatsApp preservando conexiones existentes

**Parcial. La autoridad de operaciones y la verificación del sender mejoraron; permanecen diferencias en preservación y presentación de evidencia.**

**En septiembre:** Usaba estados exactos y respetaba `done: false`. Una conexión/sender existente, incluso pendiente u offline, evitaba ofrecer de nuevo registro o edición del número. Consumía `whatsapp.self_service.v1` para orientar al administrador sin reemplazar su cuenta.

**En A:** El onboarding vigente incorpora disponibilidad por operación, distinción de credenciales/vault, generaciones de tenant y protección ante respuestas tardías. Usa estados exactos para sender y no afirma entrega real sin recibo. Sus pruebas ya verifican que el bloque de plantillas no esté listo si `done` no es `true`.

**Diferencia concreta:** En la lista general `operatorChecklist`, `readBoolean(item.done, false) || isReadyStatus(item.status)` todavía puede pintar completado un ítem con `done: false` y estado ready. `canRegisterSender` no excluye por sí mismo `hasSender`, y el input se desactiva por `senderReady`, no por cualquier conexión existente; la exposición final depende también de la autorización del backend. Falta el consumidor de self_service. No atribuir el problema del checklist al bloque de plantillas ya corregido.

**Decisión propuesta:** Contrastar esos casos con el contrato vigente y recuperar las garantías puntuales. Preservar disponibilidad/vault, revisión de sesión y ausencia de afirmaciones de entrega de la implementación nueva.

**Dependencia backend:** `twilio_tech_provider.py` sigue agregando `self_service` desde `whatsapp_self_service.py`. El backend sigue siendo la autoridad para registrar/reconfigurar; no se llamó a Twilio ni se cambió un sender.

**Fuentes S:** [src/components/integrations/WhatsappTechProviderOnboarding.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/components/integrations/WhatsappTechProviderOnboarding.tsx); [src/components/integrations/WhatsappOrganizationContext.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/components/integrations/WhatsappOrganizationContext.tsx); [src/components/integrations/whatsappSetupEvidence.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/components/integrations/whatsappSetupEvidence.ts).

**Fuentes A:** [src/components/integrations/WhatsappTechProviderOnboarding.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/integrations/WhatsappTechProviderOnboarding.tsx).

**Pruebas de referencia S:** [src/components/integrations/WhatsappTechProviderOnboarding.safety.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/components/integrations/WhatsappTechProviderOnboarding.safety.test.tsx); [src/components/integrations/whatsappSetupEvidence.test.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/components/integrations/whatsappSetupEvidence.test.ts); [src/components/integrations/WhatsappOrganizationContext.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/components/integrations/WhatsappOrganizationContext.test.tsx).

**Pruebas de referencia A / recorridos relacionados:** [src/components/integrations/WhatsappTechProviderOnboarding.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/integrations/WhatsappTechProviderOnboarding.test.tsx).

**Fuentes/pruebas B:** [services/twilio_tech_provider.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/services/twilio_tech_provider.py); [services/whatsapp_self_service.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/services/whatsapp_self_service.py); [tests/test_whatsapp_self_service.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/tests/test_whatsapp_self_service.py)

**Conflictos textuales relacionados:** `src/components/integrations/WhatsappTechProviderOnboarding.tsx`, `src/components/integrations/WhatsappTechProviderOnboarding.test.tsx`, `src/components/profile/ChannelActivationChecklist.tsx`

### C08 — Packs de WhatsApp, recibos e identidad del borrador incierto

**Parcial. Hay panel, catálogo e idempotencia básica; faltan validaciones y retiro de autoridad tras error que sí estaban en septiembre.**

**En septiembre:** Workspace con catálogo validado por tenant/versión, endpoints locales permitidos, lectura y escritura acotadas, recibo exacto y sin llamadas a proveedor. Mantenía la misma operación tras resultado incierto; 401/403 retiraban contenido privado y autoridad. Cerraba callbacks viejos, incluido A→B→A.

**En A:** El panel actual muestra previews y estados, usa capacidad del catálogo, ignora lecturas tardías de otro tenant y conserva una clave en intentos fallidos. No valida el envelope del catálogo/recibo con un parser equivalente. Un error de carga deja `scopedCatalog`; la capacidad de materializar sigue derivando de ese catálogo. Cualquier respuesta HTTP resuelta libera la clave, incluso sin recibo matching.

**Diferencia concreta:** Faltan renovación de autoridad explícita, validación de tenant/pack/recibo, bloqueo del escritor retenido y protección por generación en la mutación. El string de alcance por sí solo no distingue A→B→A; sin tenant explícito todavía inicia un GET. Estas diferencias son del consumidor; no prueban que el backend autorice una operación indebida.

**Decisión propuesta:** Priorizar recuperación de contrato y estado de operación sobre el panel actual. Reutilizar como criterios los tests de errores HTTP y callbacks retenidos; no copiar una interfaz antigua sobre operaciones nuevas.

**Dependencia backend:** `routes/whatsapp_rules.py` implementa GET `/api/admin/whatsapp/template-packs` y POST `.../:vertical/drafts`, capacidad por tenant, transacción, recibo duradero e idempotencia. El recibo informa `provider_calls_performed: false`. No se materializaron borradores en esta revisión.

**Fuentes S:** [src/hooks/useWhatsappTemplatePacks.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/hooks/useWhatsappTemplatePacks.ts); [src/components/admin/whatsappTemplatePackContract.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/components/admin/whatsappTemplatePackContract.ts); [src/components/admin/WhatsappTemplatePacksPanel.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/components/admin/WhatsappTemplatePacksPanel.tsx).

**Fuentes A:** [src/components/admin/WhatsappTemplatePacksPanel.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/admin/WhatsappTemplatePacksPanel.tsx).

**Pruebas de referencia S:** [src/components/admin/WhatsappTemplatePacksPanel.safety.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/components/admin/WhatsappTemplatePacksPanel.safety.test.tsx); [src/components/admin/WhatsappTemplatePacksPanel.retry.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/components/admin/WhatsappTemplatePacksPanel.retry.test.tsx); [src/hooks/useWhatsappTemplatePacks.authority.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/hooks/useWhatsappTemplatePacks.authority.test.tsx).

**Pruebas de referencia A / recorridos relacionados:** [src/components/admin/WhatsappTemplatePacksPanel.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/admin/WhatsappTemplatePacksPanel.test.tsx).

**Fuentes/pruebas B:** [routes/whatsapp_rules.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/routes/whatsapp_rules.py); [tests/test_whatsapp_template_packs.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/tests/test_whatsapp_template_packs.py); [tests/test_whatsapp_pack_transactions.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/tests/test_whatsapp_pack_transactions.py)

**Conflictos textuales relacionados:** Ninguno en el merge simulado; esto no elimina el riesgo semántico.

### C09 — Confirmación de pago verificada y recuperación acotada del pedido

**Falta capacidad. La garantía de pago verificado falta en una ruta actualmente montada, aunque otras pantallas de pedidos tengan un ciclo nuevo.**

**En septiembre:** `useVerifiedOrder` validaba identidad de pedido y alcance, limitaba cada consulta a 15 s y la secuencia de refrescos, pausaba offline/pestaña oculta y retiraba datos ante 401/403/404. La etiqueta de pago usaba respuesta autorizada, nunca el query string. El estado comercial se presentaba separado.

**En A:** `routesConfig` monta `OrderConfirmation` en `/pedido/confirmado` y variantes de tenant. Esa página lee `status` de la URL, hace una consulta a `/api/pedidos/:id` y calcula `effectiveStatus = order?.estado || statusFromGateway || ""`; approved/paid/pagado muestran “Pago aprobado”. No valida que el ID normalizado corresponda al solicitado. `orderLifecycle`, `OrderTrackingPage` y el cliente `fetchPaymentStatus` sí existen, pero esta página no usa ese recorrido verificado.

**Diferencia concreta:** Con una respuesta sin estado, una falla o antes de recibir respuesta, `?status=approved` puede determinar la etiqueta de aprobación. Una respuesta recibida no acredita por sí sola identidad del pedido. El hallazgo afecta a lo que la UI informa: no demuestra una transacción alterada, un cobro indebido ni un cambio en la acreditación backend. Son conclusiones del flujo fuente; no se ejecutó una compra ni una prueba en producción.

**Decisión propuesta:** Primera corrección a decidir por Claude. Trasladar la garantía y las regresiones a los contratos actuales; no restaurar ciegamente el endpoint antiguo. Esta tarea no modifica checkout.

**Dependencia backend:** B tiene `payments.status.v1` en `/api/v2/payments/status` y frontend `fetchPaymentStatus`; deben confirmarse sesión/identificadores del retorno. El alias `/api/pedidos/:id` remite al recurso legacy PymePedido protegido para admin/empleado, mientras checkout trabaja también con PedidoConversacional/MarketOrder. La selección del contrato correcto es parte del arreglo.

**Fuentes S:** [src/pages/OrderConfirmation.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/pages/OrderConfirmation.tsx); [src/hooks/useVerifiedOrder.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/hooks/useVerifiedOrder.ts); [src/utils/verifiedPaymentStatus.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/utils/verifiedPaymentStatus.ts); [src/components/orders/OrderVerificationPanel.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/components/orders/OrderVerificationPanel.tsx).

**Fuentes A:** [src/pages/OrderConfirmation.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/pages/OrderConfirmation.tsx); [src/routesConfig.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/routesConfig.tsx); [src/api/market.ts](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/api/market.ts); [src/features/orders/orderLifecycle.ts](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/features/orders/orderLifecycle.ts); [src/pages/pyme/pedidos/OrderTrackingPage.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/pages/pyme/pedidos/OrderTrackingPage.tsx).

**Pruebas de referencia S:** [src/pages/OrderConfirmation.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/pages/OrderConfirmation.test.tsx); [src/hooks/useVerifiedOrder.resilience.test.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/hooks/useVerifiedOrder.resilience.test.ts); [src/utils/verifiedPaymentStatus.test.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/utils/verifiedPaymentStatus.test.ts); [tests/e2e/order-confirmation-verification.spec.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/tests/e2e/order-confirmation-verification.spec.ts).

**Pruebas de referencia A / recorridos relacionados:** [src/features/orders/orderLifecycle.test.ts](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/features/orders/orderLifecycle.test.ts); [src/pages/pyme/pedidos/OrderTrackingPage.lifecycle.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/pages/pyme/pedidos/OrderTrackingPage.lifecycle.test.tsx).

**Fuentes/pruebas B:** [routes/api_aliases.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/routes/api_aliases.py); [routes/pedidos.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/routes/pedidos.py); [routes/checkout.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/routes/checkout.py); [routes/v2/commerce.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/routes/v2/commerce.py); [services/commerce_contracts.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/services/commerce_contracts.py)

**Conflictos textuales relacionados:** Ninguno en el merge simulado; esto no elimina el riesgo semántico.

### C10 — Foco de bandeja, categorías por tenant y SLA compacto

**Parcial. Filtros rápidos y cola accesible tienen equivalentes; el aislamiento de categorías y algunas prestaciones compactas no.**

**En septiembre:** Atajos combinables de sin leer/vencidos/sin asignar sobre los filtros existentes, limpieza específica de esos atajos, categorías retiradas al cambiar tenant e ignorado de respuestas tardías. La tarjeta compacta mostraba evidencia SLA sin inventar tiempos.

**En A:** `NewTicketsPanel.applyQuickFilter` mezcla filtros con los existentes; hay contadores, riesgo, sin leer y navegación de cola. `ticketOperationalQueue` y pruebas de Sidebar cubren navegación actual. El reset operacional borra varias dimensiones. El efecto de categorías de `Sidebar` sólo hace GET y setState: no limpia al cambiar tenant ni controla generación; `adminGetTicketCategories` tampoco pasa un `isCurrent` específico. La rama compacta de `TicketListItem` termina antes de los relojes SLA.

**Diferencia concreta:** No falta todo el inbox ni la composición de filtros. Falta la garantía explícita de categorías del tenant vigente; una respuesta vieja puede poblar ese estado del componente. También hay diferencia funcional en SLA compacto y limpieza selectiva; decidir si el diseño actual las necesita.

**Decisión propuesta:** P1 para aislamiento de categorías; P2 para los atajos y SLA compacto. Incorporar mejoras en el diseño actual, preservando búsqueda, conversación y correcciones de layout que tienen otros responsables.

**Dependencia backend:** Categorías en `/api/admin/tenants/:slug/ticket-categories` y datos SLA del contrato de tickets. No hace falta inferir nuevas métricas del lado cliente.

**Fuentes S:** [src/components/tickets/TicketQueueFocusBar.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/components/tickets/TicketQueueFocusBar.tsx); [src/utils/ticketFocusFilters.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/utils/ticketFocusFilters.ts); [src/components/tickets/Sidebar.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/components/tickets/Sidebar.tsx); [src/components/tickets/TicketListItem.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/components/tickets/TicketListItem.tsx).

**Fuentes A:** [src/components/tickets/NewTicketsPanel.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/tickets/NewTicketsPanel.tsx); [src/components/tickets/Sidebar.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/tickets/Sidebar.tsx); [src/components/tickets/TicketListItem.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/tickets/TicketListItem.tsx); [src/api/client.ts](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/api/client.ts).

**Pruebas de referencia S:** [src/components/tickets/TicketQueueFocusBar.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/components/tickets/TicketQueueFocusBar.test.tsx); [src/utils/ticketFocusFilters.test.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/utils/ticketFocusFilters.test.ts); [src/components/tickets/Sidebar.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/components/tickets/Sidebar.test.tsx); [src/components/tickets/TicketListItem.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/components/tickets/TicketListItem.test.tsx).

**Pruebas de referencia A / recorridos relacionados:** [src/components/tickets/NewTicketsPanel.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/tickets/NewTicketsPanel.test.tsx); [src/components/tickets/Sidebar.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/tickets/Sidebar.test.tsx); [src/components/tickets/TicketListItem.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/tickets/TicketListItem.test.tsx).

**Fuentes/pruebas B:** [routes/admin_tenant.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/routes/admin_tenant.py)

**Conflictos textuales relacionados:** Ninguno en el merge simulado; esto no elimina el riesgo semántico.

### C11 — Confirmación destructiva de encuestas y conciliación del workspace

**Parcial. La confirmación con identidad, bloqueo local y lectura privada segura están recuperados; faltan garantías del snapshot y conciliación completa.**

**En septiembre:** El diálogo se vinculaba al snapshot completo mostrado y se retiraba al cambiar instrumento, tenant o capacidad. Había bloqueo del workspace, expiración de callbacks y separación entre escritura confirmada y readback fallido, incluida secuencia A→B→A.

**En A:** `SurveyCard` muestra título/ID, confirma, bloquea la tarjeta mientras opera y mantiene el error cuando la acción rechaza. `useSurveyAdmin` agrega aislamiento por actor, tenant y sesión, retira listados no fiables y protege lecturas/escrituras. El listado actual agrupa `mutation + toast + await refetchList`; `refetchList` devuelve undefined ante error o lectura no realizada. Los handlers no distinguen esa falta de verificación.

**Diferencia concreta:** No hay equivalente encontrado al límite por snapshot completo: el diálogo usa las props nuevas con los booleanos locales de apertura. Tampoco al estado explícito “escritura confirmada, actualización pendiente” y bloqueo de operaciones del workspace de septiembre. El readback fallido actual sí puede ocultar datos mediante readiness: no afirmar que deja siempre una tarjeta editable obsoleta. Los handlers de página no tienen su propia lease para retirar feedback tardío tras navegar.

**Decisión propuesta:** Recuperar casos de identidad/snapshot, operación única global y resultado de readback sobre la nueva autoridad. Mantener gobernanza, permisos de jurisdicción, causalidad de sesión y paginación actuales; no reemplazar useSurveyAdmin entero.

**Dependencia backend:** Usar las capacidades/acciones actuales y sus recibos; publicación gobernada y publicación simple son recorridos distintos. Cambios de confirmación del cliente no sustituyen autorización ni control de concurrencia del servidor.

**Fuentes S:** [src/components/surveys/SurveyCard.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/components/surveys/SurveyCard.tsx); [src/components/surveys/SurveyCardView.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/components/surveys/SurveyCardView.tsx); [src/hooks/useSurveyCardActions.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/hooks/useSurveyCardActions.ts); [src/hooks/useSurveyWorkspaceLease.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/hooks/useSurveyWorkspaceLease.ts); [src/pages/admin/encuestas/index.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/pages/admin/encuestas/index.tsx).

**Fuentes A:** [src/components/surveys/SurveyCard.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/surveys/SurveyCard.tsx); [src/hooks/useSurveyAdmin.ts](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/hooks/useSurveyAdmin.ts); [src/pages/admin/encuestas/index.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/pages/admin/encuestas/index.tsx).

**Pruebas de referencia S:** [src/components/surveys/SurveyCard.confirmation.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/components/surveys/SurveyCard.confirmation.test.tsx); [src/components/surveys/SurveyCard.review.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/components/surveys/SurveyCard.review.test.tsx); [src/pages/admin/encuestas/index.operations.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/pages/admin/encuestas/index.operations.test.tsx); [src/hooks/useSurveyWorkspaceLease.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/hooks/useSurveyWorkspaceLease.test.tsx).

**Pruebas de referencia A / recorridos relacionados:** [src/components/surveys/SurveyCard.lifecycle.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/surveys/SurveyCard.lifecycle.test.tsx); [src/hooks/useSurveyAdmin.readiness.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/hooks/useSurveyAdmin.readiness.test.tsx); [src/hooks/useSurveyAdmin.requestScope.causal.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/hooks/useSurveyAdmin.requestScope.causal.test.tsx); [src/hooks/useSurveyAdmin.pagination.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/hooks/useSurveyAdmin.pagination.test.tsx).

**Fuentes/pruebas B:** [routes/encuestas_admin.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/routes/encuestas_admin.py)

**Conflictos textuales relacionados:** `src/components/surveys/SurveyCard.tsx`, `src/hooks/useSurveyAdmin.ts`, `src/pages/admin/encuestas/index.tsx`

### C12 — Evidencia de analytics y unidad de completitud

**Parcial. La corrección porcentual está recuperada y probada en fuente; falta la presentación del contrato de evidencia muestral.**

**En septiembre:** Separaba total de respuestas, base de detalle y exclusiones mediante `surveys.analytics_evidence.v1`, sin afirmar representatividad ni inferir personas. La tasa de completitud canónica está en puntos 0..100: 0,5 se muestra como 0,5 %, no 50 %.

**En A:** `SurveyAnalytics` ya formatea directamente `completionRateValue.toFixed(1)` y exige total válido; sus tests actuales incluyen 0.5→0.5%, extremos y base ausente. `SurveyResultEvidencePanel` concilia por conteo un cierre gobernado y conserva límites de privacidad. Eso no presenta la base de detalle, muestreo y limitaciones del contrato analytics_evidence de septiembre.

**Diferencia concreta:** Falta el parser/panel de `analytics_evidence`, no la corrección de porcentaje ni toda la evidencia de resultados. No reemplazar el recibo de cierre actual: responde a otra pregunta.

**Decisión propuesta:** Conservar la unidad actual. Recuperar evidencia del resumen junto a las métricas que contextualiza, respetando filtros y retirada de datos ante pérdida de autoridad. P1 si se usan esas bases para lectura operativa; P2 para extender presentación.

**Dependencia backend:** `routes/encuestas_analytics.py` agrega evidencia al summary y al módulo summary del dashboard. El servicio valida bases y puede omitir evidencia inválida; el frontend no debe inventarla.

**Fuentes S:** [src/components/surveys/SurveyAnalyticsEvidence.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/components/surveys/SurveyAnalyticsEvidence.tsx); [src/utils/surveyAnalyticsEvidence.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/utils/surveyAnalyticsEvidence.ts); [src/hooks/useSurveyAnalytics.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/hooks/useSurveyAnalytics.ts).

**Fuentes A:** [src/components/surveys/SurveyAnalytics.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/surveys/SurveyAnalytics.tsx); [src/components/surveys/SurveyResultEvidencePanel.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/surveys/SurveyResultEvidencePanel.tsx); [src/hooks/useSurveyAnalytics.ts](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/hooks/useSurveyAnalytics.ts).

**Pruebas de referencia S:** [src/components/surveys/SurveyAnalyticsEvidence.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/components/surveys/SurveyAnalyticsEvidence.test.tsx); [src/utils/surveyAnalyticsEvidence.test.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/utils/surveyAnalyticsEvidence.test.ts); [src/hooks/useSurveyAnalytics.evidence.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/hooks/useSurveyAnalytics.evidence.test.tsx).

**Pruebas de referencia A / recorridos relacionados:** [src/components/surveys/SurveyAnalytics.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/surveys/SurveyAnalytics.test.tsx); [src/components/surveys/SurveyResultEvidencePanel.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/surveys/SurveyResultEvidencePanel.test.tsx).

**Fuentes/pruebas B:** [routes/encuestas_analytics.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/routes/encuestas_analytics.py); [services/survey_analytics_evidence.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/services/survey_analytics_evidence.py); [tests/test_survey_analytics_evidence.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/tests/test_survey_analytics_evidence.py); [tests/survey_analytics_evidence_http.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/tests/survey_analytics_evidence_http.py)

**Conflictos textuales relacionados:** `src/components/surveys/SurveyAnalytics.tsx`, `src/hooks/useSurveyAnalytics.ts`

### C13 — Ficha metodológica versionada de encuestas

**Falta capacidad. La UI y cliente específicos no están recuperados; el backend conserva código, pero la migración está pendiente y el flag no se verificó.**

**En septiembre:** Workspace de declaración metodológica con 16 campos del esquema, motivo, autor/fecha, revisión del instrumento e historial. PUT versionado; sin certificación estadística ni modificación automática de resultados.

**En A:** No hay consumidor de `surveys.methodology.v1` ni llamadas a `/methodology` en el recorrido de analytics. Se inspeccionaron los paneles de gobernanza/evidencia: sus revisiones de publicación y recibos no guardan esta ficha. Un encabezado “Evidencia y metodología” en el mapa no equivale al workspace.

**Diferencia concreta:** Faltan lectura/edición/historial de la ficha metodológica. Es una capacidad separada del cuestionario, su gobernanza y sus resultados.

**Decisión propuesta:** Sólo recuperar UI si se decide habilitar el almacenamiento. Revisar migración real, flag y bloqueo global de escrituras antes de prometer guardado; no ejecutar migración como parte de este inventario.

**Dependencia backend:** B registra GET/PUT `/<id>/methodology`, contratos `surveys.methodology.v1` y `.write.v1`, modelo `survey_methodology_revision`. La migración está en `migrations/pending/20260922_add_survey_methodology_v1.py`; `SURVEY_METHODOLOGY_ENABLED` es false por defecto. GET puede devolver available=false; PUT devuelve 503 si no está habilitado. No se verificaron esquema ni flag del entorno.

**Fuentes S:** [src/components/surveys/SurveyMethodologyWorkspace.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/components/surveys/SurveyMethodologyWorkspace.tsx); [src/utils/surveyMethodology.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/utils/surveyMethodology.ts); [src/api/surveyMethodology.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/api/surveyMethodology.ts); [src/pages/admin/encuestas/[id]/analytics.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/pages/admin/encuestas/[id]/analytics.tsx).

**Fuentes A:** [src/pages/admin/encuestas/[id]/analytics.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/pages/admin/encuestas/[id]/analytics.tsx); [src/components/surveys/SurveyResultEvidencePanel.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/surveys/SurveyResultEvidencePanel.tsx).

**Pruebas de referencia S:** [src/components/surveys/SurveyMethodologyWorkspace.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/components/surveys/SurveyMethodologyWorkspace.test.tsx); [src/utils/surveyMethodology.test.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/utils/surveyMethodology.test.ts); [src/api/surveyMethodology.test.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/api/surveyMethodology.test.ts).

**Pruebas de referencia A / recorridos relacionados:** [src/components/surveys/SurveyResultEvidencePanel.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/surveys/SurveyResultEvidencePanel.test.tsx).

**Fuentes/pruebas B:** [routes/encuestas_admin.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/routes/encuestas_admin.py); [services/survey_methodology.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/services/survey_methodology.py); [services/survey_methodology_contract.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/services/survey_methodology_contract.py); [models_survey_methodology.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/models_survey_methodology.py); [migrations/pending/20260922_add_survey_methodology_v1.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/migrations/pending/20260922_add_survey_methodology_v1.py); [tests/survey_methodology_http_acceptance.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/tests/survey_methodology_http_acceptance.py); [tests/test_survey_methodology_migration.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/tests/test_survey_methodology_migration.py)

**Conflictos textuales relacionados:** `src/pages/admin/encuestas/analytics.focus.test.tsx`

### C14 — Cobertura de campo y filtros demográficos/territoriales canónicos

**Falta capacidad. Hay visualización territorial nueva; falta el informe de cobertura y el parser de opciones canónicas recuperado en septiembre.**

**En septiembre:** `SurveyFieldworkCoverage` mostraba cobertura y faltantes por canal, campaña, género, edad, territorio y coordenadas, con bases del backend. `surveyDemographicFilters` aceptaba `label/value` y territorio anidado sin revivir aliases si la opción canónica venía vacía.

**En A:** Analytics tiene mapas, evidencia jurisdiccional y permisos territoriales actuales. El armado de opciones en `[id]/analytics.tsx` sigue leyendo arrays planos con `item.clave ?? item.etiqueta`; no consume `fieldwork_coverage` ni el formato canónico `label/value` con `territorio` anidado.

**Diferencia concreta:** Faltan el panel de denominadores/faltantes y esas opciones de filtro. Un mapa con puntos autorizados no informa por sí mismo cuántos registros carecen de coordenadas o dimensión.

**Decisión propuesta:** Recuperar el parser de filtros y el panel de cobertura sobre el summary vigente. Mantener intactos los controles de jurisdicción y la decisión de ocultar mapas sin evidencia autorizada.

**Dependencia backend:** B construye `surveys.fieldwork_coverage.v1` en summary y dashboard con `get_fieldwork_coverage_counts`. El contrato puede omitirse cuando no hay base verificable; no tratar omisión como cobertura cero.

**Fuentes S:** [src/components/surveys/SurveyFieldworkCoverage.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/components/surveys/SurveyFieldworkCoverage.tsx); [src/utils/surveyFieldworkCoverage.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/utils/surveyFieldworkCoverage.ts); [src/utils/surveyDemographicFilters.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/utils/surveyDemographicFilters.ts); [src/pages/admin/encuestas/[id]/analytics.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/pages/admin/encuestas/[id]/analytics.tsx).

**Fuentes A:** [src/components/surveys/SurveyAnalytics.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/surveys/SurveyAnalytics.tsx); [src/pages/admin/encuestas/[id]/analytics.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/pages/admin/encuestas/[id]/analytics.tsx).

**Pruebas de referencia S:** [src/components/surveys/SurveyFieldworkCoverage.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/components/surveys/SurveyFieldworkCoverage.test.tsx); [src/utils/surveyFieldworkCoverage.test.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/utils/surveyFieldworkCoverage.test.ts); [src/utils/surveyDemographicFilters.test.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/utils/surveyDemographicFilters.test.ts).

**Pruebas de referencia A / recorridos relacionados:** [src/components/surveys/SurveyAnalytics.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/surveys/SurveyAnalytics.test.tsx); [src/pages/admin/encuestas/analytics.focus.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/pages/admin/encuestas/analytics.focus.test.tsx).

**Fuentes/pruebas B:** [routes/encuestas_analytics.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/routes/encuestas_analytics.py); [services/survey_fieldwork_coverage.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/services/survey_fieldwork_coverage.py); [services/encuestas_analytics_service.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/services/encuestas_analytics_service.py); [tests/test_survey_fieldwork_coverage.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/tests/test_survey_fieldwork_coverage.py); [tests/survey_fieldwork_coverage_http.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/tests/survey_fieldwork_coverage_http.py)

**Conflictos textuales relacionados:** `src/components/surveys/SurveyAnalytics.tsx`, `src/pages/admin/encuestas/analytics.focus.test.tsx`

### C15 — Comparación A/B con bases y diferencias en puntos porcentuales

**Falta capacidad. La sección actual existe, pero no representa el contrato canónico vigente ni sus bases; no es equivalente funcional.**

**En septiembre:** Consumía `surveys.segment_compare.v1`, unía filtros globales y segmentos, explicaba solapamiento y denominador por pregunta/opción. Mostraba A−B en puntos porcentuales y valor no disponible sin base. Las sugerencias respetaban también filtros globales.

**En A:** La página llama a comparación/sugerencias, pero arma la gráfica con `segmentsCompare.buckets`. Si falta delta calcula `(B−A)/max(A,1)*100`, incluso 0 cuando A=0. Los parámetros de comparación sólo combinan filtros a_/b_; las sugerencias se piden con limit. El backend canónico devuelve `questions`, `basis`, `segment_a.stats` y `segment_b.stats`, no esos buckets.

**Diferencia concreta:** Faltan lectura canónica, bases por opción, solapamiento, incorporación de filtros globales y unidad/signo correcto. No se deduce ausencia por nombres: se contrastaron los campos realmente producidos y consumidos.

**Decisión propuesta:** Priorizar adaptación al payload actual y regresiones de base vacía, filtros globales, selección múltiple y signo/unidad. Revisar el dashboard bundle actual para aprovechar sus datos sin duplicar consultas.

**Dependencia backend:** `services/survey_segment_compare.py` produce `surveys.segment_compare.v1` y describe explícitamente diferencia A−B (p.p.). Rutas `/segments/compare` y `/segments/suggestions` validan filtros. No se cargaron cohortes reales en esta auditoría.

**Fuentes S:** [src/components/surveys/SurveySegmentComparison.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/components/surveys/SurveySegmentComparison.tsx); [src/utils/surveySegmentCompare.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/utils/surveySegmentCompare.ts); [src/api/encuestas.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/api/encuestas.ts); [src/pages/admin/encuestas/[id]/analytics.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/pages/admin/encuestas/[id]/analytics.tsx).

**Fuentes A:** [src/pages/admin/encuestas/[id]/analytics.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/pages/admin/encuestas/[id]/analytics.tsx); [src/api/encuestas.ts](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/api/encuestas.ts).

**Pruebas de referencia S:** [src/components/surveys/SurveySegmentComparison.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/components/surveys/SurveySegmentComparison.test.tsx); [src/utils/surveySegmentCompare.test.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/utils/surveySegmentCompare.test.ts); [src/pages/admin/encuestas/analytics.focus.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/pages/admin/encuestas/analytics.focus.test.tsx).

**Pruebas de referencia A / recorridos relacionados:** [src/pages/admin/encuestas/analytics.focus.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/pages/admin/encuestas/analytics.focus.test.tsx).

**Fuentes/pruebas B:** [services/survey_segment_compare.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/services/survey_segment_compare.py); [services/encuestas_analytics_service.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/services/encuestas_analytics_service.py); [routes/encuestas_analytics.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/routes/encuestas_analytics.py); [tests/survey_segment_compare_http.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/tests/survey_segment_compare_http.py); [tests/test_encuestas_dashboard_bundle_contract.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/tests/test_encuestas_dashboard_bundle_contract.py)

**Conflictos textuales relacionados:** `src/pages/admin/encuestas/analytics.focus.test.tsx`

### C16 — Navegación documental /admin en desarrollo sin interceptar APIs

**Falta capacidad. Falta la separación entre documentos HTML y llamadas legacy en el proxy local de Vite; no se infiere un fallo de Vercel.**

**En septiembre:** `adminDocumentNavigation` diferenciaba GET/HEAD de navegación HTML con Fetch Metadata coherente, archivos y `/admin/login`. JSON, AJAX, POST y OPTIONS seguían al backend. Tests HTTP aseguraban conservar el preflight CORS existente.

**En A:** `vite.config.ts` conserva un proxy `/admin` sin bypass documental. Se revisaron plugins/middleware: no se encontró otro tratamiento equivalente antes de ese proxy. Las rutas React administrativas existen, pero eso no cambia por sí solo el proxy de la navegación directa.

**Diferencia concreta:** Falta el guard de desarrollo/aceptación que permite recargar documentos admin sin capturar llamadas API. Las reglas de Vercel son una capa diferente y no se probaron en vivo aquí.

**Decisión propuesta:** Recuperar la distinción para QA local antes de usar pruebas de navegación directa como evidencia de aceptación. Verificar matriz HTML/JSON/legacy/OPTIONS; no usar un rewrite amplio que sirva HTML a las APIs.

**Dependencia backend:** Depende de conservar endpoints legacy y semántica CORS actuales, no de una nueva migración. Mantener `VITE_PROXY_TARGET` y las mejoras PWA/build de noviembre.

**Fuentes S:** [src/utils/adminDocumentNavigation.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/utils/adminDocumentNavigation.ts); [vite.config.ts](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/vite.config.ts).

**Fuentes A:** [vite.config.ts](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/vite.config.ts); [src/routesConfig.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/routesConfig.tsx).

**Pruebas de referencia S:** [tests/admin-document-navigation.node.mjs](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/tests/admin-document-navigation.node.mjs); [tests/admin-document-routing.http.mjs](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/tests/admin-document-routing.http.mjs).

**Pruebas de referencia A / recorridos relacionados:** Sin prueba específica localizada en este recorte..

**Fuentes/pruebas B:** [routes/api_aliases.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/routes/api_aliases.py)

**Conflictos textuales relacionados:** Ninguno en el merge simulado; esto no elimina el riesgo semántico.

### C17 — Demo aislada de evaluación y exportación de menú/pack

**Obsoleto operativo; fuente conservada. El núcleo de evaluación está preservado con blobs idénticos; su antigua publicación no es un pendiente de recuperación.**

**En septiembre:** Login de evaluación aislado, menú derivado de fuente bloqueada, navegación accesible y pack de borradores canónico. Se mantenía separado de identidad, datos y envíos operativos.

**En A:** Se compararon blobs, no sólo nombres: workflow, entrada HTML, packaging, cinco módulos/datos de server, cuatro archivos de UI, tres pruebas y dos documentos de evaluación son idénticos (17 rutas). Además coinciden dos fixtures de perfil/workspace; total 19 altas históricas idénticas. El build actual conserva entrada de evaluación.

**Diferencia concreta:** No falta el archivo fuente de esa experiencia. La clasificación operativa se apoya en la [instrucción de Marcelo transmitida por Claude en frontend #1821, comentario 6829206808](https://github.com/inguillen87/chatboc-frontend/pull/1821#issuecomment-6829206808): dar de baja la demo vieja y no republicarla. No se deduce esa decisión del código. El login nominal institucional y el asistente actual deben evaluarse por C01, no por la demo.

**Decisión propuesta:** Mantener como referencia/archivo y no reactivar. Si se decide una demostración nueva, definir el alcance actual de manera expresa; no rescatar automáticamente URLs ni accesos históricos.

**Dependencia backend:** Los módulos de `server/evaluation` son un servidor de evaluación aislado, no el contrato operativo de tenant. No se validaron secretos, acceso ni despliegue de ese paquete.

**Fuentes S:** [server/evaluation/handler.mjs](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/server/evaluation/handler.mjs); [server/evaluation/security.mjs](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/server/evaluation/security.mjs); [server/evaluation/content.lock.json](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/server/evaluation/content.lock.json); [src/features/evaluation/EvaluationApp.tsx](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/src/features/evaluation/EvaluationApp.tsx); [scripts/packageEvaluation.mjs](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/scripts/packageEvaluation.mjs).

**Fuentes A:** [server/evaluation/handler.mjs](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/server/evaluation/handler.mjs); [server/evaluation/security.mjs](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/server/evaluation/security.mjs); [server/evaluation/content.lock.json](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/server/evaluation/content.lock.json); [src/features/evaluation/EvaluationApp.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/features/evaluation/EvaluationApp.tsx); [scripts/packageEvaluation.mjs](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/scripts/packageEvaluation.mjs); [vite.config.ts](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/vite.config.ts).

**Pruebas de referencia S:** [tests/evaluation/security.node.mjs](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/tests/evaluation/security.node.mjs); [tests/evaluation/whatsapp-pack.node.mjs](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/tests/evaluation/whatsapp-pack.node.mjs); [tests/evaluation/browser.mjs](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/tests/evaluation/browser.mjs).

**Pruebas de referencia A / recorridos relacionados:** [tests/evaluation/security.node.mjs](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/tests/evaluation/security.node.mjs); [tests/evaluation/whatsapp-pack.node.mjs](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/tests/evaluation/whatsapp-pack.node.mjs); [tests/evaluation/browser.mjs](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/tests/evaluation/browser.mjs).

**Fuentes/pruebas B:** Sin dependencia del backend operativo para la fuente aislada de evaluación.

**Conflictos textuales relacionados:** Ninguno en el merge simulado; esto no elimina el riesgo semántico.

### C18 — Política de previews y publicación emparejada de revisiones

**Parcial. El objetivo de omitir previews automáticos está recuperado; faltan opciones de emparejamiento exacto de septiembre.**

**En septiembre:** La política omitía previews Git identificados sin saltar producción. El generador QA aceptaba origen candidato permitido y SHA backend explícito; los guards de rewrites y runtime impedían usar producción o una revisión distinta como pareja verificada.

**En A:** `ignoreVercelGitPreview.mjs` omite previews GitHub; tests preservan producción. `vercel.json` tiene guard y mapa de ramas vigente. Generador y guard siguen redirigiendo QA a api-preview y prohíben referencias de producción. `buildVercelPreviewQa.ps1` fija ese origen; no tiene los parámetros de candidato/revisión del helper histórico. B sí conserva `scripts/verify_paired_preview.py`, que verifica las revisiones directa y a través del frontend, readiness y rechazo de acceso anónimo.

**Diferencia concreta:** Falta en las herramientas frontend el emparejamiento candidato+SHA de `previewBackendTarget` y su comprobación runtime (C06); no falta toda verificación de parejas en el proyecto, porque existe el probe backend. La política mult proveedor antigua y el mapa viejo de ramas no deben sustituir sin decisión al control GitHub actual. Documentos históricos de releases describen su fecha, no el estado desplegado de hoy.

**Decisión propuesta:** Acordar con Claude el mecanismo actual de publicar frontend/backend y comprobar sus revisiones. Recuperar la garantía de pareja si encaja en ese mecanismo; preservar guard y ramas actuales. Esta tarea no cambia aliases, deployments ni CI.

**Dependencia backend:** Requiere un candidato backend accesible y `/api/version` coherente, además de la configuración real de Vercel. `verify_paired_preview.py` es una herramienta existente que conviene reutilizar; no se ejecutó aquí. El source audit no verifica a qué deployment apuntan los dominios.

**Fuentes S:** [scripts/vercelGitPreviewPolicy.mjs](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/scripts/vercelGitPreviewPolicy.mjs); [scripts/previewBackendTarget.mjs](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/scripts/previewBackendTarget.mjs); [scripts/buildVercelPreviewQa.ps1](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/scripts/buildVercelPreviewQa.ps1); [scripts/generateVercelPreviewConfig.mjs](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/scripts/generateVercelPreviewConfig.mjs).

**Fuentes A:** [scripts/ignoreVercelGitPreview.mjs](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/scripts/ignoreVercelGitPreview.mjs); [scripts/buildVercelPreviewQa.ps1](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/scripts/buildVercelPreviewQa.ps1); [scripts/generateVercelPreviewConfig.mjs](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/scripts/generateVercelPreviewConfig.mjs); [scripts/guardVercelPreviewRewrites.mjs](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/scripts/guardVercelPreviewRewrites.mjs); [vercel.json](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/vercel.json).

**Pruebas de referencia S:** [scripts/vercelGitPreviewPolicy.test.mjs](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/scripts/vercelGitPreviewPolicy.test.mjs); [scripts/previewBackendTarget.test.mjs](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/scripts/previewBackendTarget.test.mjs); [scripts/guardVercelPreviewRewrites.test.mjs](https://github.com/inguillen87/chatboc-frontend/blob/714f8811ebceb2965e3c3b4e094bc335b8a89c78/scripts/guardVercelPreviewRewrites.test.mjs).

**Pruebas de referencia A / recorridos relacionados:** [scripts/ignoreVercelGitPreview.test.mjs](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/scripts/ignoreVercelGitPreview.test.mjs); [scripts/guardVercelPreviewRewrites.test.mjs](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/scripts/guardVercelPreviewRewrites.test.mjs).

**Fuentes/pruebas B:** [routes/config.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/routes/config.py); [routes/health/__init__.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/routes/health/__init__.py); [scripts/verify_paired_preview.py](https://github.com/inguillen87/chatbot-backend/blob/d0d0a5e5fc6bfe3fcc37d1a38269e894126b4ab1/scripts/verify_paired_preview.py)

**Conflictos textuales relacionados:** `vercel.json`, `src/utils/backendBootstrapGate.ts`

## 4. Orden de recuperación para decisión de Claude

| Orden | Paquete acotado | Criterio de salida antes de compartir/publicar |
| --- | --- | --- |
| 1 — P0 | **C09:** confirmación de pago | Una URL o respuesta de otro pedido nunca acredita pago; escoger contrato y autorización actuales. Verificar retorno sin sesión, pending, denegación, timeout, cambio de pedido y separación pago/etapa comercial. |
| 2 — P1 | **C08 + C11 + parte C10:** autoridad del catálogo, recibos, snapshot de confirmación, readback y categorías | Una operación incierta conserva identidad; una revocación retira autoridad; un cambio de contexto invalida callbacks y diálogos; la confirmación de escritura no se confunde con éxito de readback. Preservar controles nuevos de sesión y jurisdicción. |
| 3 — P1 | **C15 + C14 + parte C12:** contratos analíticos | Fixture real del backend exacto en comparación/summary, filtros globales coherentes, A−B en p.p., denominadores/solapamiento/faltantes visibles. Mantener tasa de completitud ya corregida y recibo de cierre separado. |
| 4 — P1 | **C07 + C06 + C18 + C16:** continuidad y aceptación | Conexión WhatsApp existente preservada; checklist respeta booleano explícito; versión emparejada y recuperación verificables; documento admin local no intercepta JSON/legacy. Coordinar con el despliegue y las pruebas actuales de Claude. |
| 5 — P2 | **C02–C05:** perfil comparado, paleta, módulos y preparación | Un único recorrido del centro actual, textos/capacidades de servidor, cambios revisables y recibos de publicación. Confirmar que estos flujos se quieren como producto y conservar mejoras de noviembre. |
| 6 — gate explícito | **C13:** metodología | Tabla/migración reconciliada con el esquema actual, flag verificado, autorización y revisión vigentes, prueba de guardado/lectura posterior. Con código presente no alcanza para prometer disponibilidad. |
| Conservar | **C01 y partes equivalentes** | Mantener identidad privada, control de sesión, porcentajes correctos, readiness temporal y guard de previews. |
| No reactivar | **C17** | Conservar archivo fuente; no volver a publicar la demo retirada ni reciclar sus accesos. |

Cada paquete debe compararse nuevamente con el HEAD que Claude vaya a integrar: esta revisión está congelada en A/B. No se recomiendan cherry-picks completos de commits que mezclan una garantía útil con UI, sesión, permisos, CI o política de despliegue ya reemplazados. Tampoco se recomienda resolver conflictos eligiendo “ours/theirs” para archivos completos.

## 5. Límites y cosas no verificadas en producción

- No se inspeccionaron en vivo los dominios, certificados, aliases ni revisiones efectivamente servidas. Este inventario no certifica paridad entre dominios ni habilita compartir subdominios.
- No se probaron login nominal, operaciones de encuestas, compras, generación de borradores, envíos, respuestas de WhatsApp ni cuentas de proveedores. Las afirmaciones son de fuente/contrato y no evidencias de operación real.
- No se consultaron esquema, historial de migraciones, flags o permisos efectivos de una base de producción. Metodología requiere esa comprobación; branding/módulos/guías dependen de elegibilidad/configuración del tenant.
- No se corrieron las pruebas de septiembre ni las suites actuales de aplicación. Un nombre de test documenta un caso existente; no representa un resultado verde de esta fecha. Tampoco se hicieron recorridos visuales/a11y en navegador.
- No se auditaron todas las capacidades añadidas después de septiembre. Se leyeron las necesarias para no declarar ausente algo reimplementado. No se considera operacional un archivo sin montaje demostrado; por ejemplo, la pantalla estática `PromptVersionsPage` no se usa como prueba de una capacidad publicada.
- La entrega es exclusivamente documental, sin recuperación ni merge de producto, cambios de CI o despliegue.

## Apéndice A. Los 46 commits exclusivos, trazables por capacidad

Orden de `git log --reverse A..S`. **Merge** es integración de historia; su aparición no cuenta como una capacidad adicional. El JSON conserva SHA completo, padres y rutas por commit no merge.

| # | Fecha | Commit | Tipo | Capacidades | Asunto original |
| ---: | --- | --- | --- | --- | --- |
| 1 | 2026-09-08 | [ef6d40f1](https://github.com/inguillen87/chatboc-frontend/commit/ef6d40f1af580b1e5786c5ec3409f3940eee66a7) | Cambio | C18 | docs(qa): record published CRM release and production boundaries |
| 2 | 2026-09-18 | [26d03406](https://github.com/inguillen87/chatboc-frontend/commit/26d034067241a240a84381012357b2c3e999ebcb) | Cambio | C09 | fix(checkout): verify payment state and add bounded recovery UX |
| 3 | 2026-09-18 | [47763992](https://github.com/inguillen87/chatboc-frontend/commit/47763992abb541a2bf5099468396e92bd3592c4e) | Merge | C09 | merge: preserve September production lineage for verified checkout |
| 4 | 2026-09-18 | [a3835918](https://github.com/inguillen87/chatboc-frontend/commit/a38359181d5407615dae5ecebdffc13c06e34c1c) | Cambio | C09 | feat(orders): resilient verification and accessible payment experience |
| 5 | 2026-09-18 | [44eaf7b6](https://github.com/inguillen87/chatboc-frontend/commit/44eaf7b62cafe743c7032c3ac84fedba05288171) | Cambio | C10 | feat(inbox): shared focus filters, scoped categories and accessible SLA queue |
| 6 | 2026-09-18 | [2defc59a](https://github.com/inguillen87/chatboc-frontend/commit/2defc59a5d902412820b0b352d56e0384da5c42e) | Cambio | C04 | feat(setup): guide organization preparation without technical jargon |
| 7 | 2026-09-18 | [e3b18d00](https://github.com/inguillen87/chatboc-frontend/commit/e3b18d00d81531485dc3f4eb7980566ec5485ea0) | Cambio | C17 | feat(evaluation): isolated demo login and source-driven accessible menus |
| 8 | 2026-09-18 | [39f95790](https://github.com/inguillen87/chatboc-frontend/commit/39f957900540e33d6f66123534f5f19eb84ae03d) | Cambio | C17 | feat(conversa): typed menu navigation and canonical WhatsApp draft pack |
| 9 | 2026-09-19 | [02a71a49](https://github.com/inguillen87/chatboc-frontend/commit/02a71a498dce9942c51fadafa7d253bbdb0195ed) | Cambio | C08 | feat(whatsapp): scoped template workspace with verified receipts and recovery |
| 10 | 2026-09-19 | [74e58fb1](https://github.com/inguillen87/chatboc-frontend/commit/74e58fb173b9e1b7089e5aa09f7e012c61a6504f) | Cambio | C08 | fix(whatsapp): preserve uncertain draft identity across HTTP and access failures |
| 11 | 2026-09-19 | [faed4089](https://github.com/inguillen87/chatboc-frontend/commit/faed4089ba636b55b30a910b4cb23fef1c42b316) | Cambio | C18 | ops: preserve guarded QA releases and skip automatic Git previews |
| 12 | 2026-09-19 | [35c269c2](https://github.com/inguillen87/chatboc-frontend/commit/35c269c29dbd351e8129feb132a046eaa84873c1) | Cambio | C07 | feat(whatsapp): preserve existing accounts and guide tenant setup with verified state |
| 13 | 2026-09-19 | [fa63b8d1](https://github.com/inguillen87/chatboc-frontend/commit/fa63b8d184181f746237a5b8761de62f795e31f7) | Merge | C07, C08 | Merge remote-tracking branch 'origin/fix/whatsapp-draft-recovery-20260919' into sprint/whatsapp-guided-readiness-20260919 |
| 14 | 2026-09-19 | [0c9b0b5a](https://github.com/inguillen87/chatboc-frontend/commit/0c9b0b5a7ec6c821463e990c010f29c87b8f490c) | Cambio | C02 | feat(profile): shared vertical-aware settings and mobile layout containment |
| 15 | 2026-09-19 | [852a506c](https://github.com/inguillen87/chatboc-frontend/commit/852a506ce5f23d83d88a0b7d51de763e5fd8f9f7) | Cambio | C02 | feat(profile): verify saves and resolve concurrent edits without losing drafts |
| 16 | 2026-09-19 | [f88dd5ff](https://github.com/inguillen87/chatboc-frontend/commit/f88dd5ff188c470c9dbf37e5f0e1da63e092214e) | Cambio | C02 | fix(profile): honor scoped administration and preserve verified empty values |
| 17 | 2026-09-19 | [c3aff0d9](https://github.com/inguillen87/chatboc-frontend/commit/c3aff0d9b9bfb1e6e5685956f71a280fa3222643) | Cambio | C06 | fix(runtime): expire readiness observations and verify a declared backend revision |
| 18 | 2026-09-19 | [793c44a0](https://github.com/inguillen87/chatboc-frontend/commit/793c44a0086d58412dbf7862faa184c208951d60) | Cambio | C06, C18 | feat(startup): accessible recovery and explicitly paired Preview routing |
| 19 | 2026-09-19 | [d6ba7e61](https://github.com/inguillen87/chatboc-frontend/commit/d6ba7e61c7525b37bbf978fb9c12de35a7c0596a) | Cambio | C06 | feat(runtime): recover connectivity without losing active edits |
| 20 | 2026-09-19 | [c90f73e0](https://github.com/inguillen87/chatboc-frontend/commit/c90f73e0cb15f82c521d1728de7ffbc042e8868d) | Cambio | C04 | feat(setup): guide each organization with scoped steps and focused workspace |
| 21 | 2026-09-19 | [2fbf08a0](https://github.com/inguillen87/chatboc-frontend/commit/2fbf08a0f5dfe235cb7c350b5ed3de308fa601c8) | Cambio | C03 | feat(branding): add scoped palette studio with preview publish and restore |
| 22 | 2026-09-20 | [d6cd07ca](https://github.com/inguillen87/chatboc-frontend/commit/d6cd07cae58115febdf9a714a1dd20b285535c56) | Cambio | C03 | feat(branding): safeguard palette drafts and compare exact publication values |
| 23 | 2026-09-20 | [c0406cb4](https://github.com/inguillen87/chatboc-frontend/commit/c0406cb4a67d2dce7ee5c3630a3ea58269869ccb) | Cambio | C03 | fix(branding): render authenticated backend workflow copy and validate its contract |
| 24 | 2026-09-20 | [4f8d0eba](https://github.com/inguillen87/chatboc-frontend/commit/4f8d0ebae5c6354b6aab33a245953eb1dac30c0f) | Cambio | C03 | fix(branding): reject Unicode controls from workflow presentation contracts |
| 25 | 2026-09-20 | [a12b6c96](https://github.com/inguillen87/chatboc-frontend/commit/a12b6c966cb6ee25c9810f9be9e6b254f1fb24a4) | Cambio | C05 | feat(setup): guide module selection with confirmation and scoped recovery |
| 26 | 2026-09-20 | [6712bf1e](https://github.com/inguillen87/chatboc-frontend/commit/6712bf1e96e1ade93cea13342bb983d2902bd449) | Cambio | C05 | fix(setup): preserve module draft when collapsing its section |
| 27 | 2026-09-20 | [c706b1df](https://github.com/inguillen87/chatboc-frontend/commit/c706b1df923a842142826b3af58f23645ad5ce5d) | Cambio | C05 | fix(setup): honor backend module catalogs and current comparison labels |
| 28 | 2026-09-21 | [2b888471](https://github.com/inguillen87/chatboc-frontend/commit/2b888471414722365a3e5d0fb2ad34f2bc6236ab) | Cambio | C05 | feat(setup): review dependent module changes before updating the draft |
| 29 | 2026-09-21 | [f62bdbda](https://github.com/inguillen87/chatboc-frontend/commit/f62bdbda0442c34804f170f1b036c4d42675134e) | Cambio | C08 | fix(whatsapp): revoke stale draft authority synchronously across failed requests |
| 30 | 2026-09-21 | [b0c3ba03](https://github.com/inguillen87/chatboc-frontend/commit/b0c3ba0382b26d8a45014c84e2c25c90ce57a2a3) | Cambio | C08 | test(whatsapp): control async settlement when exercising retained draft callbacks |
| 31 | 2026-09-21 | [ac6e642c](https://github.com/inguillen87/chatboc-frontend/commit/ac6e642cbfceab1b22779dbd881a9f15366dd530) | Cambio | C11 | fix(surveys): bind destructive confirmations to the displayed instrument |
| 32 | 2026-09-21 | [0cfa2230](https://github.com/inguillen87/chatboc-frontend/commit/0cfa22308437f03ea9fa1b892ddb5ee1e3ff64a1) | Cambio | C11 | fix(surveys): keep confirmation portals opaque and motion accessible |
| 33 | 2026-09-21 | [0c23fbbe](https://github.com/inguillen87/chatboc-frontend/commit/0c23fbbe5b4f74c16888ab6a2ac149b51adeee72) | Cambio | C11 | fix(surveys): cover the full snapshot and visibly disable blocked actions |
| 34 | 2026-09-21 | [684a9ca7](https://github.com/inguillen87/chatboc-frontend/commit/684a9ca7df26036566f1ed1cabb33553b10f1678) | Cambio | C11 | fix(surveys): preserve the concrete card prop contract in the facade |
| 35 | 2026-09-21 | [ec63a2e1](https://github.com/inguillen87/chatboc-frontend/commit/ec63a2e1e1d5d1c2b2856b54d48dfe4e5804e196) | Cambio | C11 | fix(surveys): reconcile workspace writes without false outcomes or cross-tenant feedback |
| 36 | 2026-09-21 | [1e8b8104](https://github.com/inguillen87/chatboc-frontend/commit/1e8b8104c79bc8a1391d0076c25167329f8f62d2) | Cambio | C11 | fix(surveys): show instrument identity before close or delete confirmation |
| 37 | 2026-09-22 | [affd2937](https://github.com/inguillen87/chatboc-frontend/commit/affd29378260efabeaa2458b94c81a0273dea66b) | Cambio | C16 | fix(routing): serve admin documents without masking legacy API requests |
| 38 | 2026-09-22 | [d88730d9](https://github.com/inguillen87/chatboc-frontend/commit/d88730d93593305c1fb26d5aa7e37f2af30054bc) | Cambio | C16 | test(routing): preserve the existing CORS preflight response in transport acceptance |
| 39 | 2026-09-22 | [d32b8f66](https://github.com/inguillen87/chatboc-frontend/commit/d32b8f66b65897d0caf4b62c519d6cff557f786c) | Merge | C11, C16 | Merge #1761: verified survey workspace and admin document routing |
| 40 | 2026-09-22 | [34452898](https://github.com/inguillen87/chatboc-frontend/commit/344528986bf280d2de8b4bbd5b22f0accba6e539) | Merge | C02, C03, C04, C05, C06, C07, C08 | Merge verified production profile safeguards into coordinated SaaS release |
| 41 | 2026-09-22 | [3fe6c3fa](https://github.com/inguillen87/chatboc-frontend/commit/3fe6c3fa2b025f346abd28659291d63561051cc1) | Cambio | C12 | feat(surveys): disclose analytics evidence and correct completion percentage units |
| 42 | 2026-09-23 | [5307ed78](https://github.com/inguillen87/chatboc-frontend/commit/5307ed78eec15fc76a5432d54757389faf39a751) | Cambio | C13 | feat(surveys): add versioned methodology workspace and revoke private caches |
| 43 | 2026-09-23 | [380dfe20](https://github.com/inguillen87/chatboc-frontend/commit/380dfe203a4ab7854684cba482c600ffb2362d84) | Cambio | C04 | fix(setup): preserve navigation before passive mount effects |
| 44 | 2026-09-23 | [8a19376a](https://github.com/inguillen87/chatboc-frontend/commit/8a19376acf40085491a9ebdc8e6a3480e8816a85) | Cambio | C14 | feat(surveys): show scoped fieldwork coverage and restore territory filters |
| 45 | 2026-09-23 | [d871772d](https://github.com/inguillen87/chatboc-frontend/commit/d871772de6a1fbaddb8763e84bef7ec038cd22c1) | Cambio | C15 | feat(surveys): restore scoped A/B comparison and point differences |
| 46 | 2026-09-23 | [714f8811](https://github.com/inguillen87/chatboc-frontend/commit/714f8811ebceb2965e3c3b4e094bc335b8a89c78) | Cambio | C01, C04 | feat(organizations): unify scoped login identity and private guide |

## Apéndice B. Los 31 archivos con conflicto textual

Resultado exacto del merge simulado A+S. Se muestran las capacidades que comparten el archivo o su par de pruebas. Algunas diferencias importantes —checkout, templates, Vite y comparación canónica— no generan conflicto textual en sus archivos de implementación.

| # | Ruta | Capacidades relacionadas |
| ---: | --- | --- |
| 1 | [src/api/panelLogin.test.ts](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/api/panelLogin.test.ts) | C01 |
| 2 | [src/api/panelLogin.ts](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/api/panelLogin.ts) | C01 |
| 3 | [src/api/v2/channelActivation.ts](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/api/v2/channelActivation.ts) | C04, C05 |
| 4 | [src/components/implementation/PrivateConversationGuide.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/implementation/PrivateConversationGuide.test.tsx) | C01 |
| 5 | [src/components/implementation/PrivateConversationGuide.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/implementation/PrivateConversationGuide.tsx) | C01 |
| 6 | [src/components/integrations/WhatsappTechProviderOnboarding.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/integrations/WhatsappTechProviderOnboarding.test.tsx) | C07 |
| 7 | [src/components/integrations/WhatsappTechProviderOnboarding.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/integrations/WhatsappTechProviderOnboarding.tsx) | C07 |
| 8 | [src/components/layout/Layout.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/layout/Layout.test.tsx) | C04 |
| 9 | [src/components/layout/Layout.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/layout/Layout.tsx) | C04, C06 |
| 10 | [src/components/layout/Navbar.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/layout/Navbar.test.tsx) | C01 |
| 11 | [src/components/layout/Navbar.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/layout/Navbar.tsx) | C01, C03, C06 |
| 12 | [src/components/profile/ChannelActivationChecklist.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/profile/ChannelActivationChecklist.tsx) | C04, C07 |
| 13 | [src/components/profile/InstitutionProfileWorkspace.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/profile/InstitutionProfileWorkspace.tsx) | C02, C03, C05 |
| 14 | [src/components/surveys/SurveyAnalytics.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/surveys/SurveyAnalytics.tsx) | C12, C14 |
| 15 | [src/components/surveys/SurveyCard.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/components/surveys/SurveyCard.tsx) | C11 |
| 16 | [src/hooks/useSurveyAdmin.ts](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/hooks/useSurveyAdmin.ts) | C11 |
| 17 | [src/hooks/useSurveyAnalytics.ts](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/hooks/useSurveyAnalytics.ts) | C12 |
| 18 | [src/hooks/useUser.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/hooks/useUser.test.tsx) | C01 |
| 19 | [src/hooks/useUser.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/hooks/useUser.tsx) | C01, C02 |
| 20 | [src/pages/Login.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/pages/Login.tsx) | C01 |
| 21 | [src/pages/Perfil.requestLifecycle.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/pages/Perfil.requestLifecycle.test.tsx) | C02 |
| 22 | [src/pages/Perfil.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/pages/Perfil.tsx) | C02, C03, C05 |
| 23 | [src/pages/TenantImplementationCenterPage.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/pages/TenantImplementationCenterPage.tsx) | C03, C04, C05 |
| 24 | [src/pages/admin/encuestas/analytics.focus.test.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/pages/admin/encuestas/analytics.focus.test.tsx) | C13, C14, C15 |
| 25 | [src/pages/admin/encuestas/index.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/pages/admin/encuestas/index.tsx) | C11 |
| 26 | [src/utils/backendBootstrapGate.ts](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/utils/backendBootstrapGate.ts) | C06, C18 |
| 27 | [src/utils/panelLoginScope.ts](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/utils/panelLoginScope.ts) | C01 |
| 28 | [src/utils/panelLoginSession.ts](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/utils/panelLoginSession.ts) | C01 |
| 29 | [src/utils/privateConversationGuide.test.ts](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/utils/privateConversationGuide.test.ts) | C01 |
| 30 | [src/utils/privateConversationGuide.ts](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/utils/privateConversationGuide.ts) | C01 |
| 31 | [vercel.json](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/vercel.json) | C18 |

## Apéndice C. Altas de septiembre presentes con el mismo blob

Estas 19 coincidencias son exactas por objeto Git. Las 17 rutas de evaluación forman el núcleo preservado de C17; las otras dos son fixtures de organización. No es un conteo de funcionalidades operativas.

| Ruta | Grupo |
| --- | --- |
| [.github/workflows/evaluation-access.yml](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/.github/workflows/evaluation-access.yml) | Evaluación preservada (C17) |
| [demo/evaluation/index.html](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/demo/evaluation/index.html) | Evaluación preservada (C17) |
| [docs/CONVERSA_WHATSAPP_PACK_RELEASE.md](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/docs/CONVERSA_WHATSAPP_PACK_RELEASE.md) | Evaluación preservada (C17) |
| [docs/EVALUATION_ACCESS_AND_MENUS.md](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/docs/EVALUATION_ACCESS_AND_MENUS.md) | Evaluación preservada (C17) |
| [scripts/packageEvaluation.mjs](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/scripts/packageEvaluation.mjs) | Evaluación preservada (C17) |
| [server/evaluation/content.lock.json](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/server/evaluation/content.lock.json) | Evaluación preservada (C17) |
| [server/evaluation/guide.mjs](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/server/evaluation/guide.mjs) | Evaluación preservada (C17) |
| [server/evaluation/handler.mjs](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/server/evaluation/handler.mjs) | Evaluación preservada (C17) |
| [server/evaluation/security.mjs](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/server/evaluation/security.mjs) | Evaluación preservada (C17) |
| [server/evaluation/whatsapp-pack.mjs](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/server/evaluation/whatsapp-pack.mjs) | Evaluación preservada (C17) |
| [src/features/evaluation/ConversationMenu.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/features/evaluation/ConversationMenu.tsx) | Evaluación preservada (C17) |
| [src/features/evaluation/EvaluationApp.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/features/evaluation/EvaluationApp.tsx) | Evaluación preservada (C17) |
| [src/features/evaluation/entry.tsx](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/features/evaluation/entry.tsx) | Evaluación preservada (C17) |
| [src/features/evaluation/evaluation.css](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/src/features/evaluation/evaluation.css) | Evaluación preservada (C17) |
| [tests/evaluation/browser.mjs](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/tests/evaluation/browser.mjs) | Evaluación preservada (C17) |
| [tests/evaluation/security.node.mjs](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/tests/evaluation/security.node.mjs) | Evaluación preservada (C17) |
| [tests/evaluation/whatsapp-pack.node.mjs](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/tests/evaluation/whatsapp-pack.node.mjs) | Evaluación preservada (C17) |
| [tests/fixtures/organization-profile-settings.json](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/tests/fixtures/organization-profile-settings.json) | Fixture de perfil/workspace |
| [tests/fixtures/organization-workspaces.json](https://github.com/inguillen87/chatboc-frontend/blob/2055b560616f93d2b3c3eaadc13d4966f0a5f045/tests/fixtures/organization-workspaces.json) | Fixture de perfil/workspace |

Las otras 7 altas presentes con contenido diferente son `src/api/panelLogin.ts`, su test, `src/utils/panelLoginScope.ts`, `PrivateConversationGuide.tsx`, su test, `src/utils/privateConversationGuide.ts` y su test. Su comportamiento se evaluó en C01 en lugar de etiquetarlas como perdidas por diferencia de blob.

## Validación del inventario

Se validaron las revisiones exactas, el conteo de 46 commits y sus 4 merges, las 292 rutas (235 altas/57 modificaciones), los 31 conflictos, los 19 blobs idénticos y la existencia de cada fuente/prueba enlazada en su snapshot. Se comprobó que el cambio del worktree se limita a este documento y su JSON. `git diff --check` forma parte del cierre documental; no sustituye pruebas funcionales de una futura recuperación.
