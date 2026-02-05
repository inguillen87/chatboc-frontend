import re
from copy import deepcopy
from datetime import datetime
from urllib.parse import urlparse

DEFAULT_WIDGET = {
    "brand": {
        "name": "Chatboc",
        "primaryColor": "#2563eb",
        "accentColor": "#22c55e",
        "logoUrl": "",
        "avatarUrl": ""
    },
    "launcher": {
        "position": "right",  # right|left
        "offsetX": 24,
        "offsetY": 24,
        "shape": "circle",    # circle|rounded
        "size": 60
    },
    "ui": {
        "theme": "light",     # light|dark|auto
        "borderRadius": 16,
        "shadow": True,
        "animations": True,
        "sounds": False
    },
    "copy": {
        "welcomeTitle": "Hola 👋",
        "welcomeSubtitle": "¿En qué te puedo ayudar?",
        "inputPlaceholder": "Escribí tu mensaje…"
    },
    "behavior": {
        "mode": "auto",                 # auto|pyme|municipio
        "startOpen": False,
        "requireName": True,
        "publicRubros": [],             # si querés selector por rubro en widget público
        "allowAnonymous": True,
        "anonymousLimit": 10
    },
    "security": {
        "allowedDomains": [],           # lista de hosts permitidos
        "blockUnknownDomains": False    # si True: rechaza embed fuera de allowlist
    },
    "runtime": {
        "socketUrl": "wss://chatbot-backend-2e14.onrender.com",
        "apiBase": "https://api.chatboc.ar"
    }
}

def _is_hex_color(v: str) -> bool:
    return bool(re.fullmatch(r"#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})", (v or "").strip()))

def _clean_host(domain: str) -> str:
    domain = (domain or "").strip().lower()
    domain = domain.replace("http://", "").replace("https://", "")
    domain = domain.split("/")[0]
    return domain

def normalize_widget_config(raw: dict) -> dict:
    cfg = deepcopy(DEFAULT_WIDGET)
    raw = raw or {}

    def deep_merge(dst, src):
        for k, v in (src or {}).items():
            if isinstance(v, dict) and isinstance(dst.get(k), dict):
                deep_merge(dst[k], v)
            else:
                dst[k] = v

    deep_merge(cfg, raw)

    # sanitización básica
    brand = cfg["brand"]
    if not _is_hex_color(brand.get("primaryColor")):
        brand["primaryColor"] = DEFAULT_WIDGET["brand"]["primaryColor"]
    if not _is_hex_color(brand.get("accentColor")):
        brand["accentColor"] = DEFAULT_WIDGET["brand"]["accentColor"]

    sec = cfg["security"]
    sec["allowedDomains"] = [h for h in map(_clean_host, sec.get("allowedDomains", [])) if h]
    sec["allowedDomains"] = sorted(list(set(sec["allowedDomains"])))

    # límites
    beh = cfg["behavior"]
    beh["anonymousLimit"] = max(1, min(int(beh.get("anonymousLimit") or 10), 200))

    cfg["_meta"] = {
        "normalizedAt": datetime.utcnow().isoformat() + "Z"
    }
    return cfg

def is_origin_allowed(origin: str, cfg: dict) -> bool:
    sec = (cfg or {}).get("security") or {}
    allow = sec.get("allowedDomains") or []
    block_unknown = bool(sec.get("blockUnknownDomains"))

    if not origin:
        return not block_unknown  # si bloquea desconocidos y no hay origin => denegar

    try:
        host = urlparse(origin).hostname
    except Exception:
        host = None

    if not host:
        return not block_unknown

    host = host.lower()
    if not allow:
        return not block_unknown

    # match exacto o subdominio
    for a in allow:
        if host == a or host.endswith("." + a):
            return True

    return False
