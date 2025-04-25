#!/usr/bin/env python3
"""
Playwright UI Tests for Benedictaitor

This test suite verifies the UI functionality of the Benedictaitor application using Playwright.
"""

import os
import json
import asyncio
from playwright.async_api import async_playwright

# Test configuration
APP_URL = "https://34522ab7-4880-49aa-98ce-1ae5e45aa9cc-00-67qrwrk3v299.picard.replit.dev"
TEACHER_URL = f"{APP_URL}/teacher"
STUDENT_URL = f"{APP_URL}/student"
SCREENSHOTS_DIR = "screenshots"

async def setup():
    """Set up test environment."""
    # Create screenshots directory if it doesn't exist
    if not os.path.exists(SCREENSHOTS_DIR):
        os.makedirs(SCREENSHOTS_DIR)
    
    return True

async def test_teacher_interface(page):
    """Test the Teacher Interface UI elements."""
    print("Testing Teacher Interface UI...")
    
    # Navigate to teacher page
    await page.goto(TEACHER_URL)
    
    # Check for essential UI elements
    header = await page.query_selector("header")
    start_button = await page.query_selector('button[data-testid="start-recording"]')
    stop_button = await page.query_selector('button[data-testid="stop-recording"]')
    transcript_container = await page.query_selector('[data-testid="transcript-container"]')
    
    # Take screenshot
    await page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "teacher-interface.png"))
    
    # Assert that all required elements exist
    assert header is not None, "Header not found"
    assert start_button is not None, "Start recording button not found"
    assert stop_button is not None, "Stop recording button not found"
    assert transcript_container is not None, "Transcript container not found"
    
    print("✓ Teacher Interface test passed")
    return True

async def test_student_interface(page):
    """Test the Student Interface UI elements."""
    print("Testing Student Interface UI...")
    
    # Navigate to student page
    await page.goto(STUDENT_URL)
    
    # Check for essential UI elements
    header = await page.query_selector("header")
    language_selector = await page.query_selector('select[data-testid="language-selector"]')
    translation_container = await page.query_selector('[data-testid="translation-container"]')
    
    # Take screenshot
    await page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "student-interface.png"))
    
    # Assert that all required elements exist
    assert header is not None, "Header not found"
    assert language_selector is not None, "Language selector not found"
    assert translation_container is not None, "Translation container not found"
    
    print("✓ Student Interface test passed")
    return True

async def test_language_selection(page):
    """Test language selection functionality."""
    print("Testing Language Selection...")
    
    # Navigate to student page
    await page.goto(STUDENT_URL)
    
    # Find and select Spanish in the language dropdown
    await page.select_option('select[data-testid="language-selector"]', 'es-ES')
    
    # Wait for selection to take effect
    await page.wait_for_timeout(500)
    
    # Verify the selected value is Spanish
    selected_value = await page.evaluate('() => document.querySelector(\'select[data-testid="language-selector"]\').value')
    
    # Take screenshot
    await page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "language-selection.png"))
    
    # Assert that Spanish is selected
    assert selected_value == "es-ES", f"Expected es-ES but got {selected_value}"
    
    print("✓ Language Selection test passed")
    return True

async def test_recording_buttons(page):
    """Test recording button functionality."""
    print("Testing Recording Buttons...")
    
    # Navigate to teacher page
    await page.goto(TEACHER_URL)
    
    # Check initial state of stop button (should be disabled)
    stop_button = await page.query_selector('button[data-testid="stop-recording"]')
    initial_stop_disabled = await stop_button.get_attribute("disabled") is not None
    
    # Click start button
    await page.click('button[data-testid="start-recording"]')
    
    # Wait for UI to update
    await page.wait_for_timeout(1000)
    
    # Check that stop button is now enabled
    stop_button = await page.query_selector('button[data-testid="stop-recording"]')
    stop_enabled_after_start = await stop_button.get_attribute("disabled") is None
    
    # Click stop button
    await page.click('button[data-testid="stop-recording"]')
    
    # Wait for UI to update
    await page.wait_for_timeout(1000)
    
    # Check that stop button is disabled again
    stop_button = await page.query_selector('button[data-testid="stop-recording"]')
    stop_disabled_after_stop = await stop_button.get_attribute("disabled") is not None
    
    # Take screenshot
    await page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "recording-buttons.png"))
    
    # Assert button state transitions
    assert initial_stop_disabled, "Stop button should be initially disabled"
    assert stop_enabled_after_start, "Stop button should be enabled after clicking start"
    assert stop_disabled_after_stop, "Stop button should be disabled after clicking stop"
    
    print("✓ Recording Buttons test passed")
    return True

async def test_transcription_display(page):
    """Test real-time transcription display."""
    print("Testing Transcription Display...")
    
    # Navigate to teacher page
    await page.goto(TEACHER_URL)
    
    # Inject test transcription by running JavaScript in the browser
    test_text = "This is a test transcription message"
    await page.evaluate(f"""() => {{
        // Create a fake WebSocket message event
        const event = {{
            data: JSON.stringify({{
                type: 'transcription',
                text: '{test_text}',
                isFinal: true
            }})
        }};
        
        // Call the message handler directly if it exists
        if (window.webSocketClient && window.webSocketClient.ws && window.webSocketClient.ws.onmessage) {{
            window.webSocketClient.ws.onmessage(event);
        }} else {{
            // If not accessible, dispatch a custom event that our app listens to
            document.dispatchEvent(new CustomEvent('test-transcription', {{
                detail: {{
                    text: '{test_text}',
                    isFinal: true
                }}
            }}));
        }}
    }}""")
    
    try:
        # Wait for the transcription to appear (with a timeout)
        await page.wait_for_selector(f"//*[contains(text(), '{test_text}')]", timeout=5000)
        
        # Take screenshot
        await page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "transcription-display.png"))
        
        print("✓ Transcription Display test passed")
        return True
    except Exception as e:
        await page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "transcription-display-error.png"))
        print(f"✗ Transcription Display test failed: {e}")
        return False

async def run_tests():
    """Run all Playwright UI tests."""
    await setup()
    
    results = {
        "tests_run": 0,
        "failures": 0,
        "errors": 0,
        "success": True,
        "test_details": {}
    }
    
    async with async_playwright() as p:
        # Use Chromium in headless mode with appropriate flags for Replit
        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-accelerated-2d-canvas",
                "--no-first-run",
                "--no-zygote",
                "--disable-gpu"
            ]
        )
        
        # Create a new context with a larger viewport
        context = await browser.new_context(
            viewport={"width": 1280, "height": 720}
        )
        
        # Create a new page
        page = await context.new_page()
        
        # Run tests
        tests = [
            ("test_teacher_interface", test_teacher_interface),
            ("test_student_interface", test_student_interface),
            ("test_language_selection", test_language_selection),
            ("test_recording_buttons", test_recording_buttons),
            ("test_transcription_display", test_transcription_display)
        ]
        
        for test_name, test_func in tests:
            results["tests_run"] += 1
            try:
                test_passed = await test_func(page)
                if not test_passed:
                    results["failures"] += 1
                    results["success"] = False
                    results["test_details"][test_name] = {
                        "status": "FAIL",
                        "message": "Test returned False"
                    }
            except Exception as e:
                results["errors"] += 1
                results["success"] = False
                results["test_details"][test_name] = {
                    "status": "ERROR",
                    "message": str(e)
                }
                print(f"✗ {test_name} failed with error: {e}")
        
        # Close the browser
        await browser.close()
    
    # Print summary
    print("\n----- Playwright UI Test Results -----")
    print(f"Tests run: {results['tests_run']}")
    print(f"Failures: {results['failures']}")
    print(f"Errors: {results['errors']}")
    print(f"Success: {results['success']}")
    
    # Write results to a JSON file
    with open('playwright_test_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    return results["success"]

if __name__ == "__main__":
    success = asyncio.run(run_tests())
    exit(0 if success else 1)