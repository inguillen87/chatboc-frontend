from playwright.sync_api import Page, expect, sync_playwright
import json
import time

def verify_mirror_catalog(page: Page):
    BASE_URL = "http://localhost:4173"
    TENANT_SLUG = "demo-bodega" # Use bodega which has the mock item

    # 1. Setup Tenant Context
    print(f"Setting up Tenant Context for {TENANT_SLUG}...")
    page.goto(f"{BASE_URL}/demo/{TENANT_SLUG}")
    page.wait_for_timeout(1000)

    # 2. Go to Catalog
    print("Navigating to Catalog...")
    page.goto(f"{BASE_URL}/{TENANT_SLUG}/productos")
    page.wait_for_timeout(2000)

    # 3. Check for the Mirror Item
    # We added "Pack Malbec (Mercado Libre)" to MOCK_CATALOGS['bodega']
    print("Checking for Mirror Catalog item...")

    if page.get_by_text("Pack Malbec (Mercado Libre)").is_visible():
        print("Mirror Item Found.")

        # Check for the External Link Button
        # The button text should be "Comprar en Mercado Libre"
        button = page.get_by_text("Comprar en Mercado Libre")
        if button.is_visible():
            print("SUCCESS: 'Comprar en Mercado Libre' button is visible.")
            page.screenshot(path="/home/jules/verification/mirror_catalog_success.png", full_page=True)
        else:
            print("FAILED: Button not found.")
            page.screenshot(path="/home/jules/verification/mirror_catalog_failed_button.png", full_page=True)
    else:
        print("FAILED: Mirror Item not found in list.")
        page.screenshot(path="/home/jules/verification/mirror_catalog_failed_item.png", full_page=True)

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_mirror_catalog(page)
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()
