from datetime import datetime
from yourapp.extensions import db  # ajustá import

class TenantWidgetConfig(db.Model):
    __tablename__ = "tenant_widget_config"

    tenant_slug = db.Column(db.String(120), primary_key=True)
    live_json = db.Column(db.JSON, nullable=False, default=dict)
    draft_json = db.Column(db.JSON, nullable=True)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
