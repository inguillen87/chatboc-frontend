from flask import Blueprint, jsonify, request
from yourapp.extensions import db
from yourapp.models.tenant_widget_config import TenantWidgetConfig
from yourapp.services.widget_config_service import normalize_widget_config, is_origin_allowed
from yourapp.services.auth_context import get_auth_context

bp = Blueprint("widget_config", __name__)

def api_error(status, code, message, extra=None):
    payload = {"error": {"code": code, "message": message}}
    if extra:
        payload["error"]["extra"] = extra
    return jsonify(payload), status

@bp.get("/api/public/tenants/<tenant_slug>/widget-config")
def public_widget_config(tenant_slug):
    auth = get_auth_context(allow_cookie=False)
    row = TenantWidgetConfig.query.get(tenant_slug)
    live = (row.live_json if row else {}) or {}
    cfg = normalize_widget_config(live)

    origin = request.headers.get("Origin")
    if not is_origin_allowed(origin, cfg):
        return api_error(403, "domain_not_allowed", "Este dominio no está autorizado para embeber el widget.", {"origin": origin})

    # devolver solo lo necesario
    return jsonify({"tenant_slug": tenant_slug, "config": cfg}), 200

@bp.get("/api/admin/tenants/<tenant_slug>/widget-config")
def admin_get_widget_config(tenant_slug):
    auth = get_auth_context(allow_cookie=True)
    if not auth.viewer_user_id or not auth.is_admin:
        return api_error(401, "unauthorized", "No autorizado.")

    row = TenantWidgetConfig.query.get(tenant_slug)
    if not row:
        row = TenantWidgetConfig(tenant_slug=tenant_slug, live_json={}, draft_json={})
        db.session.add(row)
        db.session.commit()

    return jsonify({
        "tenant_slug": tenant_slug,
        "live": normalize_widget_config(row.live_json or {}),
        "draft": normalize_widget_config(row.draft_json or row.live_json or {})
    }), 200

@bp.post("/api/admin/tenants/<tenant_slug>/widget-config/preview")
def admin_preview_widget_config(tenant_slug):
    auth = get_auth_context(allow_cookie=True)
    if not auth.viewer_user_id or not auth.is_admin:
        return api_error(401, "unauthorized", "No autorizado.")

    raw = (request.json or {}).get("config") or {}
    cfg = normalize_widget_config(raw)
    return jsonify({"tenant_slug": tenant_slug, "preview": cfg}), 200

@bp.put("/api/admin/tenants/<tenant_slug>/widget-config")
def admin_save_draft_widget_config(tenant_slug):
    auth = get_auth_context(allow_cookie=True)
    if not auth.viewer_user_id or not auth.is_admin:
        return api_error(401, "unauthorized", "No autorizado.")

    raw = (request.json or {}).get("config") or {}
    cfg = normalize_widget_config(raw)

    row = TenantWidgetConfig.query.get(tenant_slug)
    if not row:
        row = TenantWidgetConfig(tenant_slug=tenant_slug, live_json={}, draft_json={})
        db.session.add(row)

    row.draft_json = cfg
    db.session.commit()
    return jsonify({"ok": True, "tenant_slug": tenant_slug, "draft": cfg}), 200

@bp.post("/api/admin/tenants/<tenant_slug>/widget-config/publish")
def admin_publish_widget_config(tenant_slug):
    auth = get_auth_context(allow_cookie=True)
    if not auth.viewer_user_id or not auth.is_admin:
        return api_error(401, "unauthorized", "No autorizado.")

    row = TenantWidgetConfig.query.get(tenant_slug)
    if not row:
        return api_error(404, "not_found", "No existe config para este tenant.")

    row.live_json = row.draft_json or row.live_json or {}
    db.session.commit()

    return jsonify({"ok": True, "tenant_slug": tenant_slug, "live": normalize_widget_config(row.live_json)}), 200
