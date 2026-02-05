from flask import request, jsonify
from yourapp.services.auth_context import get_auth_context

def resolve_request_mode():
    # si viene entityToken => widget público (NO cookies)
    if (request.args.get("entityToken") or request.headers.get("X-Entity-Token")):
        return "public_widget"
    # si viene Bearer => usuario logueado en widget/iframe
    if (request.headers.get("Authorization","").lower().startswith("bearer ")):
        return "widget_user"
    # si es panel /app
    if request.path.startswith("/api/app") or request.path.startswith("/api/admin"):
        return "panel"
    return "public_site"

# Example of how to patch ask_municipio
# @route("/api/ask/municipio", methods=["POST"])
def ask_municipio_patched():
    mode = resolve_request_mode()
    auth = get_auth_context(allow_cookie=(mode == "panel"))

    # 🔥 CLAVE: si mode es public_widget, auth.viewer_user_id SIEMPRE debe ser None.
    # owner_user_id vendrá del entityToken.
    # y tu lógica interna debe usar owner_user_id como "municipio dueño" SIN habilitar cosas privadas.

    owner_user_id = auth.owner_user_id
    viewer_user_id = auth.viewer_user_id

    # ✅ Reglas:
    # - public_widget: owner_user_id != None, viewer_user_id == None
    # - widget_user: owner_user_id puede existir (si también mandás entityToken) pero viewer_user_id != None
    # - panel: viewer_user_id != None

    # Implement your logic here...
    return jsonify({"status": "ok", "mode": mode})
