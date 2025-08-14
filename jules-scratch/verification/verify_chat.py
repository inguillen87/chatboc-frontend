from playwright.sync_api import sync_playwright, expect
import time

def run_verification():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        print("Starting test...")
        # 1. Arrange: Go to the application's homepage.
        # The dev server runs on port 5173 by default for Vite.
        page.goto("http://localhost:5173")
        print("Navigated to homepage.")

        # 2. Act: Find and click the button to open the chat widget.
        # We'll look for a button with a name related to chat. This might need adjustment.
        # Let's give it a few seconds to appear.
        time.sleep(5)

        # Look for a button that opens the chat widget
        chat_widget_button = page.locator('button:has-text("Chat"), button[aria-label*="chat"], #chat-widget-button').first
        expect(chat_widget_button).to_be_visible(timeout=10000)
        chat_widget_button.click()
        print("Clicked chat widget button.")

        # 3. Act: Find the "Hacer un Reclamo" button and click it.
        # The button is inside a frame. Let's find the frame first.
        chat_frame = page.frame_locator('iframe[title="Chat Widget"]') # A more robust selector for the iframe

        reclamo_button = chat_frame.get_by_role("button", name="Hacer un Reclamo")
        expect(reclamo_button).to_be_visible()
        reclamo_button.click()
        print("Clicked 'Hacer un Reclamo' button.")

        # 4. Assert: Wait for the bot's response and check for the menu.
        # We expect to see the title of the claims menu.
        expect(chat_frame.get_by_text("Tipos de Reclamo")).to_be_visible()
        print("Verified claims menu is visible.")

        # 5. Screenshot: Capture the final result for visual verification.
        page.screenshot(path="jules-scratch/verification/verification.png")
        print("Screenshot taken.")

        browser.close()

if __name__ == "__main__":
    run_verification()
