# Resolución de errores de permiso 403

Si el backend registra mensajes como:

```
[WARNING] app - PERMISO DENEGADO | endpoint=ticket_bp.get_panel_por_categoria | user_id=6
```

y la respuesta HTTP es `403`, el usuario no posee los roles necesarios para ese endpoint.

Verificá en el panel de administración o mediante la CLI del backend que el usuario tenga asignado el rol `admin` o `empleado`. El backend puede reportar alias como `admin_municipio` o `empleado_pyme`, que la interfaz trata como equivalentes. Después de actualizar el rol, volvé a intentar la operación.

También confirmá que el usuario posea `tipo_chat: municipio` y que el token de sesión enviado por el frontend sea válido. Si el token expiró o está ausente, el backend responderá 401 o 403.
