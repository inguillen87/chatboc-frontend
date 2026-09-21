# Biblioteca de plantillas y confirmación de borradores

Siguiente fase sobre la única línea canónica de configuración #1756/#2790.
No incorpora ni reemplaza la rama productiva de recuperación #1758/#2791.

El workspace permite búsqueda por nombre, intención, contenido y texto del botón,
sin distinguir mayúsculas o acentos. Filtra por estado y muestra cantidades sobre
el conjunto actual. Si una actualización elimina el último resultado del filtro,
se conserva el filtro con cero resultados: nunca cambia silenciosamente a todos.
La búsqueda es local a los datos autorizados ya recibidos; no hace llamadas de red.

Crear borradores exige revisar organización, conjunto y versión en un diálogo.
La acción afecta el conjunto completo, no sólo lo visible tras filtrar. No envía
mensajes, crea contenido de proveedor ni solicita aprobación. Se reutilizan el
hook, endpoint, revisión del recibo y clave de idempotencia existentes.
Una actualización de catálogo, pérdida de permiso, error o cambio de organización
invalida la confirmación abierta. No hay guardado automático ni reenvío de POST.

Los textos nuevos proceden del campo aditivo frontend_contract.workspace_ui,
contrato whatsapp.template_pack.workspace_ui.v1. La configuración faltante conserva
el panel legacy por compatibilidad de despliegue. Una configuración publicada pero
inválida se rechaza: no habilita un camino de creación sin confirmación.
El padre conserva un único hook/lectura; no se monta un segundo fetch oculto.

El estado aprobado sólo se presenta con production_send_allowed verdadero y sin
bloqueos, reutilizando la política existente. Ni el contador ni el selector cambian
permisos o representan una comprobación nueva de entrega al proveedor.
La UI usa tokens de tema, layout móvil/tablet, foco visible y movimiento reducido.

Pruebas nuevas: búsqueda, filtros estables, limpieza, confirmación/cancelación,
conjunto completo pese a búsqueda, permiso, aprobación no verificada, vista stale,
cambio de organización y compatibilidad/validación del contrato. CI final y prueba
contra backend completo se registran en los PR coordinados. No afirmar publicación,
aprobación Meta, mensajería real, instalación PWA o hardware a partir de estos tests.

Publicación pendiente del acceso autorizado a Vercel. No se cambian dominios,
webhooks, números, planes, cuentas o bases de clientes. No se entrega un ZIP como
sustituto del código integrado: el cambio queda en GitHub y la evidencia en CI.
