from playwright.sync_api import Page, expect, sync_playwright
import json
import time

def verify_commerce_pages(page: Page):
    BASE_URL = "http://localhost:4173"
    TENANT_SLUG = "demo-pyme"

    # Inject Mock Auth State
    print("Injecting Admin Session...")
    page.goto(f"{BASE_URL}")

    user_mock = {
        "id": "1",
        "name": "Admin User",
        "email": "admin@chatboc.ar",
        "rol": "admin",
        "tipo_chat": "pyme",
        "tenantSlug": TENANT_SLUG,
        "tenant": {
            "slug": TENANT_SLUG,
            "tipo": "pyme"
        }
    }

    page.evaluate(f"""() => {{
        localStorage.setItem('authToken', 'mock-admin-token');
        localStorage.setItem('user', '{json.dumps(user_mock)}');
        localStorage.setItem('tenantSlug', '{TENANT_SLUG}');
    }}""")

    # 2. Verify Pyme Integrations Page
    print("Verifying Integrations Page...")
    page.goto(f"{BASE_URL}/pyme/{TENANT_SLUG}/integracion")
    page.wait_for_timeout(3000)

    # Check for "Guardar Cambios" button presence (to ensure settings form loaded)
    if page.get_by_role("button", name="Guardar Cambios").is_visible():
        print("Integration Settings Form Loaded")
        page.screenshot(path="/home/jules/verification/integrations_settings_form.png", full_page=True)
    else:
        print("Integration Settings Form NOT Found")

    # 3. Verify Pyme Orders Page (Admin)
    print("Verifying Pyme Orders Page...")
    page.goto(f"{BASE_URL}/pyme/{TENANT_SLUG}/pedidos")
    page.wait_for_timeout(3000)

    if page.get_by_role("heading", name="Gestión de Pedidos").is_visible():
        print("Admin Orders Page Loaded")

        # Check for Create Order Button
        if page.get_by_text("Crear Pedido").is_visible():
             print("Create Order Button Visible")

        page.screenshot(path="/home/jules/verification/admin_orders_enhanced.png", full_page=True)
    else:
        print("Admin Orders Page heading not found.")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_commerce_pages(page)
        except Exception as e:
            print(f"Verification Failed: {e}")
        finally:
            browser.close()
