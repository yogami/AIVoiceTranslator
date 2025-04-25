#!/usr/bin/env python3
"""
Selenium UI Tests for Benedictaitor

This test suite verifies the UI functionality of the Benedictaitor application using Selenium WebDriver.
"""

import os
import time
import unittest
import json
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

# Test configuration
APP_URL = "https://34522ab7-4880-49aa-98ce-1ae5e45aa9cc-00-67qrwrk3v299.picard.replit.dev"
TEACHER_URL = f"{APP_URL}/teacher"
STUDENT_URL = f"{APP_URL}/student"
TEST_TIMEOUT = 30  # seconds
SCREENSHOTS_DIR = "screenshots"

class BenedictaitorUITests(unittest.TestCase):
    """UI Tests for Benedictaitor application."""

    @classmethod
    def setUpClass(cls):
        """Set up the WebDriver and create a screenshots directory."""
        # Create screenshots directory if it doesn't exist
        if not os.path.exists(SCREENSHOTS_DIR):
            os.makedirs(SCREENSHOTS_DIR)
            
        # Setup Chrome options for headless operation in Replit
        chrome_options = Options()
        chrome_options.add_argument("--headless=new")  # Use the newer headless mode
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-gpu")
        chrome_options.add_argument("--window-size=1280,1024")
        chrome_options.add_argument("--disable-extensions")
        chrome_options.add_argument("--disable-infobars")
        chrome_options.add_argument("--ignore-certificate-errors")
        
        print("Setting up ChromeDriver...")
        # Use the Node.js ChromeDriver that was installed via npm
        try:
            chrome_driver_path = "/home/runner/workspace/node_modules/.bin/chromedriver"
            cls.driver = webdriver.Chrome(
                service=Service(chrome_driver_path),
                options=chrome_options
            )
        except Exception as e:
            print(f"Error using Node.js ChromeDriver: {e}")
            print("Falling back to webdriver_manager...")
            try:
                cls.driver = webdriver.Chrome(
                    service=Service(ChromeDriverManager().install()),
                    options=chrome_options
                )
            except Exception as e2:
                print(f"Error with webdriver_manager: {e2}")
                raise
        print("ChromeDriver setup complete.")

    @classmethod
    def tearDownClass(cls):
        """Close the WebDriver."""
        cls.driver.quit()

    def take_screenshot(self, name):
        """Take a screenshot and save it to the screenshots directory."""
        screenshot_path = os.path.join(SCREENSHOTS_DIR, f"{name}.png")
        self.driver.save_screenshot(screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

    def element_exists(self, selector, timeout=5):
        """Check if an element exists on the page."""
        try:
            WebDriverWait(self.driver, timeout).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, selector))
            )
            return True
        except Exception as e:
            print(f"Element not found: {selector}")
            print(f"Error: {e}")
            return False

    def test_01_teacher_interface(self):
        """Test the Teacher Interface UI elements."""
        print("Testing Teacher Interface UI...")
        
        # Navigate to teacher page
        self.driver.get(TEACHER_URL)
        WebDriverWait(self.driver, 10).until(
            EC.title_contains("Benedictaitor")
        )
        
        # Check for essential UI elements
        header_exists = self.element_exists("header")
        start_button_exists = self.element_exists('button[data-testid="start-recording"]')
        stop_button_exists = self.element_exists('button[data-testid="stop-recording"]')
        transcript_container_exists = self.element_exists('[data-testid="transcript-container"]')
        
        self.take_screenshot("teacher-interface")
        
        # Assert that all required elements exist
        self.assertTrue(header_exists, "Header not found")
        self.assertTrue(start_button_exists, "Start recording button not found")
        self.assertTrue(stop_button_exists, "Stop recording button not found")
        self.assertTrue(transcript_container_exists, "Transcript container not found")

    def test_02_student_interface(self):
        """Test the Student Interface UI elements."""
        print("Testing Student Interface UI...")
        
        # Navigate to student page
        self.driver.get(STUDENT_URL)
        WebDriverWait(self.driver, 10).until(
            EC.title_contains("Benedictaitor")
        )
        
        # Check for essential UI elements
        header_exists = self.element_exists("header")
        language_selector_exists = self.element_exists('select[data-testid="language-selector"]')
        translation_container_exists = self.element_exists('[data-testid="translation-container"]')
        
        self.take_screenshot("student-interface")
        
        # Assert that all required elements exist
        self.assertTrue(header_exists, "Header not found")
        self.assertTrue(language_selector_exists, "Language selector not found")
        self.assertTrue(translation_container_exists, "Translation container not found")

    def test_03_language_selection(self):
        """Test language selection functionality."""
        print("Testing Language Selection...")
        
        # Navigate to student page
        self.driver.get(STUDENT_URL)
        WebDriverWait(self.driver, 10).until(
            EC.title_contains("Benedictaitor")
        )
        
        # Find and click language selector
        language_selector = self.driver.find_element(By.CSS_SELECTOR, 'select[data-testid="language-selector"]')
        language_selector.click()
        
        # Select Spanish
        spanish_option = self.driver.find_element(By.CSS_SELECTOR, 'option[value="es-ES"]')
        spanish_option.click()
        
        # Wait for selection to take effect
        time.sleep(0.5)
        
        # Verify the selected value is Spanish
        selected_value = language_selector.get_attribute("value")
        
        self.take_screenshot("language-selection")
        
        # Assert that Spanish is selected
        self.assertEqual(selected_value, "es-ES", f"Expected es-ES but got {selected_value}")

    def test_04_recording_buttons(self):
        """Test recording button functionality."""
        print("Testing Recording Buttons...")
        
        # Navigate to teacher page
        self.driver.get(TEACHER_URL)
        WebDriverWait(self.driver, 10).until(
            EC.title_contains("Benedictaitor")
        )
        
        # Get the start and stop buttons
        start_button = self.driver.find_element(By.CSS_SELECTOR, 'button[data-testid="start-recording"]')
        stop_button = self.driver.find_element(By.CSS_SELECTOR, 'button[data-testid="stop-recording"]')
        
        # Check initial state - stop button should be disabled
        initial_stop_disabled = stop_button.get_attribute("disabled")
        
        # Click start button
        start_button.click()
        
        # Wait for UI to update
        time.sleep(1)
        
        # Check that stop button is now enabled
        stop_enabled_after_start = not stop_button.get_attribute("disabled")
        
        # Click stop button
        stop_button.click()
        
        # Wait for UI to update
        time.sleep(1)
        
        # Check that stop button is disabled again
        stop_disabled_after_stop = stop_button.get_attribute("disabled")
        
        self.take_screenshot("recording-buttons")
        
        # Assert button state transitions
        self.assertTrue(initial_stop_disabled, "Stop button should be initially disabled")
        self.assertTrue(stop_enabled_after_start, "Stop button should be enabled after clicking start")
        self.assertTrue(stop_disabled_after_stop, "Stop button should be disabled after clicking stop")

    def test_05_transcription_display(self):
        """Test real-time transcription display."""
        print("Testing Transcription Display...")
        
        # Navigate to teacher page
        self.driver.get(TEACHER_URL)
        WebDriverWait(self.driver, 10).until(
            EC.title_contains("Benedictaitor")
        )
        
        # Inject test transcription by running JavaScript in the browser
        test_text = "This is a test transcription message"
        self.driver.execute_script(f"""
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
        """)
        
        # Wait for the transcription to appear
        try:
            WebDriverWait(self.driver, 5).until(
                EC.presence_of_element_located((By.XPATH, f"//*[contains(text(), '{test_text}')]"))
            )
            
            # Verify transcription is displayed
            transcript_elements = self.driver.find_elements(By.XPATH, f"//*[contains(text(), '{test_text}')]")
            
            self.take_screenshot("transcription-display")
            
            # Assert that transcription is displayed
            self.assertTrue(len(transcript_elements) > 0, "Transcription text not found in UI")
        except Exception as e:
            self.take_screenshot("transcription-display-error")
            self.fail(f"Failed to find transcription: {e}")

def run_tests():
    """Run all the Selenium UI tests."""
    suite = unittest.TestLoader().loadTestsFromTestCase(BenedictaitorUITests)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    
    # Print summary
    print("\n----- Selenium UI Test Results -----")
    print(f"Tests run: {result.testsRun}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    print(f"Skipped: {len(result.skipped)}")
    
    # Write results to a JSON file
    results_data = {
        "tests_run": result.testsRun,
        "failures": len(result.failures),
        "errors": len(result.errors),
        "skipped": len(result.skipped),
        "success": result.wasSuccessful(),
        "test_details": {}
    }
    
    # Add detail for each test failure
    for test, error in result.failures + result.errors:
        test_name = test.id().split('.')[-1]
        results_data["test_details"][test_name] = {
            "status": "FAIL" if test in [f[0] for f in result.failures] else "ERROR",
            "message": str(error)
        }
    
    # Write results to file
    with open('selenium_test_results.json', 'w') as f:
        json.dump(results_data, f, indent=2)
    
    return result.wasSuccessful()

if __name__ == "__main__":
    success = run_tests()
    exit(0 if success else 1)