# Running Real Selenium Tests on Benedictaitor

This guide explains how to run actual Selenium tests against the Benedictaitor application on your local machine.

## Prerequisites

1. **Install Node.js**: Download and install from https://nodejs.org/ (LTS version recommended)
2. **Google Chrome or Firefox**: Make sure you have one of these browsers installed
3. **Terminal access**: You'll run commands in Terminal

## Setup Steps

1. **Extract MacTestRunner.zip** to a folder on your Mac

2. **Install dependencies**:
   ```bash
   cd path/to/extracted/folder
   npm install
   ```

3. **Install Selenium WebDriver**:
   ```bash
   npm install -g selenium-webdriver chromedriver
   ```

## Running Tests

### Option 1: Run the application and tests separately (recommended)

1. **Start the Benedictaitor application** (in Terminal window 1):
   ```bash
   cd path/to/extracted/folder
   npm run dev
   ```

2. **Run the Selenium tests** (in Terminal window 2):
   ```bash
   cd path/to/extracted/folder
   node tests/e2e-selenium-test.js
   ```

### Option 2: Use the test runner script

1. **Make the script executable**:
   ```bash
   cd path/to/extracted/folder
   chmod +x ./run-mac-tests.sh
   ```

2. **Run the test script**:
   ```bash
   ./run-mac-tests.sh
   ```

3. **Choose option 5** when prompted to run the E2E Selenium tests

## Troubleshooting

- **"ChromeDriver not found"**: Run `npm install -g chromedriver` and make sure it's in your PATH
- **Port in use errors**: Make sure no other instances of the app are running
- **Permission issues**: Run `chmod +x tests/e2e-selenium-test.js` to make the test script executable

## Understanding the Test Results

The test will:
1. Open a browser automatically
2. Navigate to the Benedictaitor teacher interface
3. Test audio input and WebSocket communication
4. Verify that messages are sent and received correctly
5. Output the results to the console

If all tests pass, you'll see "All tests completed successfully!" in the console output.