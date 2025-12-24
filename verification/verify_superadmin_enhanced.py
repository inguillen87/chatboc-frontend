from playwright.sync_api import Page, expect, sync_playwright
import json
import time

def verify_superadmin_tabs(page: Page):
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

    # 3. Open Edit Modal via table row
    # Just grab the first edit button we can find
    print("Opening Edit Modal...")
    try:
        # Sometimes icons are hard to click by title in playwright if title is on button
        # Let's try locating the row and then the button
        page.locator("table tbody tr").first.locator("button").first.click()
        page.wait_for_timeout(1000)

        # 4. Verify Tabs
        if page.get_by_role("tab", name="Usuarios").is_visible():
            print("SUCCESS: 'Usuarios' tab is visible.")
            page.get_by_role("tab", name="Usuarios").click()
            page.wait_for_timeout(500)

            # Check for sub-forms
            if page.get_by_text("Crear Nuevo Admin").is_visible():
                print("SUCCESS: User Creation form visible.")
            else:
                print("FAILED: User Creation form missing.")

        else:
            print("FAILED: Tabs not found in Edit mode.")
            page.screenshot(path="/home/jules/verification/superadmin_tabs_fail.png")

    except Exception as e:
        print(f"FAILED to verify tabs: {e}")
        page.screenshot(path="/home/jules/verification/superadmin_error.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_superadmin_tabs(page)
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()
