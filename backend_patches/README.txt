Backend Patches for Chatboc Security & Configuration

1. Copy the contents of models/, services/, and routes/ to your backend repository.
2. Register the widget_config_bp in your app.py.
3. Update /api/ask endpoints using the logic in routes/ask_patch.py to use AuthContext and ignore cookies in public mode.
4. Run DB migrations to create tenant_widget_config table.
