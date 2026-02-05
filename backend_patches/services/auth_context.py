from dataclasses import dataclass
from flask import request
from yourapp.services.jwt_service import decode_jwt_user  # ajustá
from yourapp.models import User  # ajustá
from yourapp.services.entity_token_service import resolve_entity_token  # ajustá

@dataclass
class AuthContext:
    viewer_user: object | None
    viewer_user_id: int | None
    owner_user_id: int | None   # dueño del entityToken/tenant
    auth_type: str              # "bearer"|"entity"|"none"|"cookie"
    is_admin: bool

def get_auth_context(*, allow_cookie: bool) -> AuthContext:
    """
    allow_cookie = False para widget público.
    allow_cookie = True solo para /app/* (panel).
    """
    # 1) Bearer
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("bearer "):
        token = auth.split(" ", 1)[1].strip()
        payload = decode_jwt_user(token)
        if payload:
            user = User.query.get(payload["user_id"])
            return AuthContext(
                viewer_user=user,
                viewer_user_id=user.id if user else None,
                owner_user_id=None,
                auth_type="bearer",
                is_admin=bool(payload.get("role") == "admin")
            )

    # 2) Entity token (público)
    entity_token = request.args.get("entityToken") or request.headers.get("X-Entity-Token")
    if entity_token:
        resolved = resolve_entity_token(entity_token)  # debe devolver {owner_user_id, tenant_slug, ...}
        if resolved:
            return AuthContext(
                viewer_user=None,
                viewer_user_id=None,
                owner_user_id=resolved["owner_user_id"],
                auth_type="entity",
                is_admin=False
            )

    # 3) Cookie (solo panel)
    if allow_cookie:
        cookie_token = request.cookies.get("auth_token")
        if cookie_token:
            payload = decode_jwt_user(cookie_token)
            if payload:
                user = User.query.get(payload["user_id"])
                return AuthContext(
                    viewer_user=user,
                    viewer_user_id=user.id if user else None,
                    owner_user_id=None,
                    auth_type="cookie",
                    is_admin=bool(payload.get("role") == "admin")
                )

    return AuthContext(None, None, None, "none", False)
