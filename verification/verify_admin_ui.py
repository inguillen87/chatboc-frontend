from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()

        page = context.new_page()

        # Listen for console logs
        page.on("console", lambda msg: print(f"Browser Console: {msg.text}"))
        page.on("pageerror", lambda err: print(f"Browser Error: {err}"))

        # Mock auth to bypass login
        page.add_init_script("""
            localStorage.setItem('authToken', 'mock-admin-token');
            localStorage.setItem('user', JSON.stringify({
                id: 1,
                name: 'Admin User',
                email: 'admin@demo.com',
                role: 'admin',
                rol: 'admin',
                tipo_chat: 'pyme'
            }));
            localStorage.setItem('tenantSlug', 'demo');
        """)

        # Mock API responses to prevent 404s/500s from blocking UI
        def handle_route(route):
            url = route.request.url
            if "integrations" in url:
                route.fulfill(status=200, content_type="application/json", body='[{"provider": "mercadolibre", "connected": true, "lastSync": "2023-10-27T10:00:00Z"}, {"provider": "whatsapp", "connected": true}]')
            elif "notifications" in url:
                route.fulfill(status=200, content_type="application/json", body='{"owner_phone": "123456", "notification_settings": {"whatsapp": true}}')
            elif "orders" in url:
                 route.fulfill(status=200, content_type="application/json", body='[]')
            elif "perfil" in url: # Tenant profile for context
                 route.fulfill(status=200, content_type="application/json", body='{"nombre": "Demo Pyme", "slug": "demo", "tipo": "pyme"}')
            else:
                route.fulfill(status=200, content_type="application/json", body='{}')

        page.route("**/api/**", handle_route)

        print("Navigating to Integrations Page...")
        # Use 'demo' as tenant
        try:
            page.goto("http://localhost:5173/demo/integracion", timeout=30000)

            # Debug: Print URL
            print(f"Current URL: {page.url}")

            page.wait_for_selector("h1:has-text('Integraciones y Personalización')", timeout=10000)
            print("Integrations page loaded.")
            page.screenshot(path="verification/integrations_tab.png")

            print("Switching to Customization Tab...")
            # Click the tab trigger. ShadCN tabs usually have role="tab"
            page.get_by_role("tab", name="Apariencia del Chat").click()
            page.wait_for_selector("text=Vista Previa en Vivo", timeout=5000)
            page.screenshot(path="verification/customizer_tab.png")

        except Exception as e:
            print(f"Error verifying integrations page: {e}")
            print(f"Failed at URL: {page.url}")
            page.screenshot(path="verification/error_integrations.png")

        print("Navigating to Order Detail...")
        try:
            page.goto("http://localhost:5173/demo/pedidos/101")

            # Check for header or error message
            page.wait_for_selector(".container", timeout=5000)
            page.wait_for_timeout(1000) # Wait for potential render
            page.screenshot(path="verification/order_detail.png")
        except Exception as e:
            print(f"Error verifying order detail: {e}")
            page.screenshot(path="verification/error_order.png")

        browser.close()

if __name__ == "__main__":
    run()
