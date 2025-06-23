# Resolución de errores de permiso 403

Si el backend registra mensajes como:

```
[WARNING] app - PERMISO DENEGADO | endpoint=ticket_bp.get_panel_por_categoria | user_id=6
```

y la respuesta HTTP es `403`, el usuario no posee los roles necesarios para ese endpoint.

Verificá en el panel de administración o mediante la CLI del backend que el usuario tenga asignado el rol `admin` o `empleado`. Después de actualizar el rol, volvé a intentar la operación.
