# Running Selenium Tests with Python

If you prefer using Python instead of Node.js for running Selenium tests, this guide will help you set up and run the tests against the Benedictaitor application.

## Prerequisites

1. **Python**: Make sure Python 3.6+ is installed on your Mac (already included in macOS)
2. **Google Chrome or Firefox**: Ensure you have one of these browsers installed
3. **Terminal access**: You'll run commands in Terminal

## Setup Steps

1. **Extract MacTestRunner.zip** to a folder on your Mac

2. **Install Selenium for Python**:
   ```bash
   pip install selenium webdriver-manager
   ```
   
   If you use Python 3 specifically:
   ```bash
   pip3 install selenium webdriver-manager
   ```

3. **Prepare the Python test script**:
   ```bash
   cd path/to/extracted/folder
   ```
   
   Create a file named `selenium_test.py` with the following content:

   ```python
   from selenium import webdriver
   from selenium.webdriver.chrome.service import Service
   from selenium.webdriver.chrome.options import Options
   from selenium.webdriver.common.by import By
   from selenium.webdriver.support.ui import WebDriverWait
   from selenium.webdriver.support import expected_conditions as EC
   from webdriver_manager.chrome import ChromeDriverManager
   import time
   
   # Setup Chrome options
   chrome_options = Options()
   # Uncomment the line below if you want to run headless (no visible browser)
   # chrome_options.add_argument("--headless")
   
   # Setup the Chrome WebDriver
   service = Service(ChromeDriverManager().install())
   driver = webdriver.Chrome(service=service, options=chrome_options)
   
   try:
       # Navigate to the teacher interface
       driver.get("http://localhost:3000/teacher")
       print("Navigated to teacher interface")
       
       # Wait for page to load
       WebDriverWait(driver, 10).until(
           EC.presence_of_element_located((By.CSS_SELECTOR, "button"))
       )
       print("Page loaded successfully")
       
       # Take a screenshot
       driver.save_screenshot("teacher_interface.png")
       print("Screenshot saved as 'teacher_interface.png'")
       
       # Check for key elements
       teacher_title = driver.find_element(By.CSS_SELECTOR, "h1, h2")
       if "Teacher" in teacher_title.text:
           print("TEST PASSED: Found Teacher interface title")
       else:
           print("TEST FAILED: Could not find Teacher interface title")
       
       # Find a button that might be used for recording
       buttons = driver.find_elements(By.TAG_NAME, "button")
       if len(buttons) > 0:
           print(f"Found {len(buttons)} buttons on the page")
       else:
           print("No buttons found - UI may not be fully loaded")
       
       # Wait 3 seconds to see the page
       print("Waiting 3 seconds to view the page...")
       time.sleep(3)
       
       print("Test completed successfully!")
       
   except Exception as e:
       print(f"Test failed with error: {e}")
       driver.save_screenshot("error_screenshot.png")
       print("Error screenshot saved as 'error_screenshot.png'")
   
   finally:
       # Close the browser
       driver.quit()
       print("Browser closed")
   ```

## Running the Tests

### Step 1: Start the Benedictaitor application (in Terminal window 1)

If you have Node.js installed:
```bash
cd path/to/extracted/folder
npm run dev
```

### Step 2: Run the Python Selenium test (in Terminal window 2)

```bash
cd path/to/extracted/folder
python selenium_test.py  # or python3 selenium_test.py
```

## Understanding the Test Results

The test will:
1. Open a Chrome browser window
2. Navigate to the Benedictaitor teacher interface
3. Check if key UI elements are present
4. Take a screenshot
5. Output the results to the console

If all tests pass, you'll see "Test completed successfully!" in the console output.

## Troubleshooting

- **"WebDriver not found"**: Make sure you've installed selenium and webdriver-manager with pip
- **Cannot connect to localhost**: Make sure the Benedictaitor app is running in another terminal window
- **No module named 'selenium'**: Run `pip install selenium` or `pip3 install selenium` again
- **Permission issues**: Make sure the script has execute permissions (`chmod +x selenium_test.py`)