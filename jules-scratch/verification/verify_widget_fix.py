import time
from playwright.sync_api import sync_playwright, expect

def run_verification(playwright):
    """
    This script verifies the chat widget's audio message functionality.
    1. Navigates to a test page containing the widget.
    2. Opens the widget.
    3. Clicks the microphone button to simulate sending an audio message.
    4. Verifies that the "Enviando audio..." feedback message appears.
    5. Takes a screenshot.
    """
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        # Step 1: Navigate to the test page
        # Using a dummy token as required by the test page script.
        # The dev server runs on port 5173.
        # We add tipo_chat=municipio to the URL to prevent an API call
        # that can fail or hang in the test environment. This ensures the widget loads.
        test_url = "http://localhost:5173/test-widget.html?token=demo-token&tipo_chat=municipio"
        page.goto(test_url, wait_until="networkidle")

        print(f"Navigated to {test_url}")

        # The widget is inside an iframe with a dynamic ID.
        # We must use a stable locator like the title attribute.
        print("Looking for widget iframe...")
        iframe = page.frame_locator('[title="Chatboc Asistente Virtual"]')

        # We can wait for an element inside the iframe to be visible to ensure it's loaded.
        expect(iframe.locator("body")).to_be_visible(timeout=15000)
        print("Widget iframe found and loaded.")

        # The widget starts open because of `data-default-open='true'`

        # Step 2: Locate and click the microphone button
        mic_button = iframe.locator('[aria-label="Grabar audio"]')
        expect(mic_button).to_be_enabled()

        print("Microphone button found. Simulating audio recording.")

        # Click to start recording
        mic_button.click()

        # Wait a moment to simulate recording
        page.wait_for_timeout(1000)

        # Click again to stop recording and send
        # The aria-label changes, so we locate it again
        stop_mic_button = iframe.locator('[aria-label="Detener grabación"]')
        expect(stop_mic_button).to_be_visible()
        stop_mic_button.click()

        # Step 3: Verify the feedback message
        # The "Enviando audio..." message should appear in the chat log.
        # This is the key change I implemented.
        feedback_message = iframe.get_by_text("Enviando audio...")
        expect(feedback_message).to_be_visible(timeout=5000)

        print("Feedback message 'Enviando audio...' verified successfully.")

        # Step 4: Take a screenshot for visual confirmation
        screenshot_path = "jules-scratch/verification/widget_audio_test.png"
        page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

    except Exception as e:
        print(f"An error occurred during verification: {e}")
        # Take a screenshot on error for debugging
        page.screenshot(path="jules-scratch/verification/error_screenshot.png")
        raise

    finally:
        # Clean up
        context.close()
        browser.close()

if __name__ == "__main__":
    with sync_playwright() as playwright:
        run_verification(playwright)
