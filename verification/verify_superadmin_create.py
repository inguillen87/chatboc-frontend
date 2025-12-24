from playwright.sync_api import Page, expect, sync_playwright
import json
import time

def verify_superadmin_create_form(page: Page):
    BASE_URL = "http://localhost:4173"

    # 1. Inject Super Admin Session
    print("Injecting Super Admin Session...")
    page.goto(f"{BASE_URL}")

    user_mock = {
        "id": "999",
        "name": "Super Admin User",
        "email": "superadmin@chatboc.ar",
        "rol": "super_admin",
        "tipo_chat": "pyme"
    }

    page.evaluate(f"""() => {{
        localStorage.setItem('authToken', 'mock-superadmin-token');
        localStorage.setItem('user', '{json.dumps(user_mock)}');
    }}""")

    # 2. Navigate to Dashboard
    print("Navigating to /superadmin...")
    page.goto(f"{BASE_URL}/superadmin")
    page.wait_for_timeout(2000)

    # 3. Open Create Modal
    print("Opening Create Modal...")
    page.get_by_text("Nuevo Tenant").click()
    page.wait_for_timeout(1000)

    # 4. Verify New Fields (WhatsApp Sender)
    if page.get_by_label("WhatsApp Sender (Opcional)").is_visible():
        print("SUCCESS: WhatsApp Sender input visible in Create form.")
        page.screenshot(path="/home/jules/verification/superadmin_create_success.png")
    else:
        print("FAILED: WhatsApp Sender input missing.")
        page.screenshot(path="/home/jules/verification/superadmin_create_fail.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_superadmin_create_form(page)
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()
