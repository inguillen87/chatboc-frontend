
import time
from playwright.sync_api import sync_playwright, expect

def verify_demo_structure(page):
    # Capture console logs to debug
    page.on("console", lambda msg: print(f"Browser Console: {msg.text}"))

    print("Navigating to landing page...")
    # UPDATED PORT TO 5174
    try:
        page.goto("http://localhost:5174/", timeout=60000)
    except Exception as e:
        print(f"Navigation failed: {e}")
        return

    # Wait for the Demos section to load
    print("Waiting for demos section...")
    try:
        demos_section = page.locator("#demos")
        expect(demos_section).to_be_visible(timeout=30000)
    except Exception as e:
        print("Demos section not visible. Screenshotting state.")
        page.screenshot(path="verification/demos_missing.png")
        raise e

    # Check for "Municipios y Gobierno" tab (Root 1)
    print("Checking for 'Municipios y Gobierno' tab...")
    tab_municipios = page.get_by_role("tab", name="Municipios y Gobierno")
    expect(tab_municipios).to_be_visible()

    # Check for "Locales Comerciales" tab (Root 2)
    print("Checking for 'Locales Comerciales' tab...")
    tab_comerciales = page.get_by_role("tab", name="Locales Comerciales")
    expect(tab_comerciales).to_be_visible()

    # Click Locales Comerciales to see content
    print("Clicking 'Locales Comerciales'...")
    tab_comerciales.click()

    # Wait for animations
    time.sleep(2)

    # Verify subcategories like "Alimentación y Bebidas"
    print("Verifying subcategory 'Alimentación y Bebidas'...")
    sub_alimentacion = page.get_by_role("heading", name="Alimentación y Bebidas")
    expect(sub_alimentacion).to_be_visible()

    # Verify specific demo card "Bodega Demo"
    print("Verifying 'Bodega Demo' card...")
    card_bodega = page.get_by_text("Bodega Demo")
    expect(card_bodega).to_be_visible()

    # Take screenshot of the Demo Section
    print("Taking screenshot of Demo Section...")
    page.screenshot(path="verification/demo_landing.png")

def verify_widget_hierarchy(page):
    # This might require interacting with the widget iframe or shadow DOM if applicable
    # Since we are using "standalone" mode in development usually, or iframe
    # Let's assume standalone or try to find the button

    print("Checking for Widget Toggle Button...")
    # The widget button is usually fixed at bottom right
    widget_btn = page.locator("[data-testid='chat-widget'] button")
    if widget_btn.count() > 0:
        print("Widget button found, clicking...")
        widget_btn.click()
    else:
        # Maybe it's already open?
        print("Widget button not found, checking if open...")

    time.sleep(2)

    # Check for "Bienvenido a Chatboc"
    print("Checking for Widget Welcome...")
    welcome_text = page.get_by_text("¡Bienvenido a Chatboc!")
    if welcome_text.count() > 0:
        expect(welcome_text).to_be_visible()

        # Check for Rubro Selector Items
        # Should see "Municipios y Gobierno" and "Locales Comerciales" in the accordion
        print("Checking Rubro Selector in Widget...")

        # Accordion triggers
        trigger_muni = page.get_by_role("button", name="Municipios y Gobierno")
        trigger_comer = page.get_by_role("button", name="Locales Comerciales")

        expect(trigger_muni).to_be_visible()
        expect(trigger_comer).to_be_visible()

        print("Taking screenshot of Widget with Hierarchy...")
        page.screenshot(path="verification/widget_hierarchy.png")
    else:
        print("Widget welcome not found. Taking debug screenshot.")
        page.screenshot(path="verification/widget_debug.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Emulate a desktop to ensure tabs are visible
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        try:
            verify_demo_structure(page)
            # Reload to reset state for widget check
            page.reload()
            time.sleep(2)
            verify_widget_hierarchy(page)
        except Exception as e:
            print(f"Error during verification: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()
