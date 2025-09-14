from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(
        device_scale_factor=2,
        viewport={'width': 1280, 'height': 800}
    )
    page = context.new_page()

    # Navigate to the test page
    page.goto("http://localhost:5178/test-details")

    # Wait for the component to be visible
    page.wait_for_selector('aside')

    # Take a screenshot
    page.screenshot(path="jules-scratch/verification/verification.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
