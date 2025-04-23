# Benedictaitor E2E Testing Guide

This guide explains how to run complete end-to-end tests on the Benedictaitor application with real browsers using Selenium.

## Quick Start

1. Download and extract the testing package (e2e-selenium-tests.zip)
2. Clone your Benedictaitor repository or use the extracted test files in your existing project
3. Choose between Python or JavaScript implementation
4. Run the tests following the steps below

## Prerequisites

### For JavaScript Testing:

1. **Node.js**: Install from https://nodejs.org/ (LTS version recommended)
2. **OpenAI API Key**: For creating test audio files (set as environment variable)
3. **Chrome/Firefox**: Web browser and corresponding WebDriver

```bash
# Install required packages
npm install selenium-webdriver chromedriver openai fs path
```

### For Python Testing:

1. **Python 3.6+**: Already included in macOS
2. **Selenium & WebDriver Manager**: For browser automation
3. **Chrome/Firefox**: Web browser

```bash
# Install required packages
pip install selenium webdriver-manager
```

## Step 1: Generate Test Audio

For proper testing, you should have real test audio files:

```bash
# Set your OpenAI API key
export OPENAI_API_KEY=your_api_key_here

# Generate test audio using the provided script
node setup-test-audio.js
```

This creates:
- `test-audio.mp3`: Audio file for testing
- `test-message.txt`: Text content of the audio

## Step 2: Run the E2E Tests

### Option A: JavaScript Implementation

```bash
# Run the E2E test
node full-e2e-test.js
```

### Option B: Python Implementation

```bash
# Run the Python E2E test
python python_full_e2e_test.py  # or python3 python_full_e2e_test.py
```

## What the Tests Do

Both implementations:

1. Start the Benedictaitor application server automatically
2. Launch a Chrome browser using Selenium WebDriver
3. Navigate to the teacher interface
4. Inject JavaScript to mock audio recording
5. Click the record button
6. Wait for speech recognition to process
7. Verify transcriptions appear in the UI
8. Take screenshots at key points of the process
9. Clean up resources when done

## Understanding Test Results

The tests will output:

- Detailed logs of each test step
- Screenshots of the application at different stages
- Error information if things go wrong

Screenshots are saved to:
- `teacher-interface.png`: Initial application state
- `test-completed.png`: Final state after testing
- `error-screenshot.png`: If an error occurs

## Troubleshooting

### WebDriver Issues

If you get errors about ChromeDriver:

```bash
# JavaScript
npm install -g chromedriver

# Python
pip install --upgrade webdriver-manager
```

### Port Already in Use

If the app can't start because port 3000 is already in use:

```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 [PID]
```

### Testing Without Browser UI

To run tests headless (without visible browser UI):

1. Uncomment the headless options in the test script
2. JavaScript: `options.addArguments('--headless')`
3. Python: `options.add_argument('--headless')`

## Extending the Tests

You can easily extend these tests to:

1. Test the student interface
2. Verify specific translation outputs
3. Test different languages
4. Add actual audio input via system microphone
5. Test the full end-to-end pipeline with OpenAI integration

## Best Practices

1. Always run tests on a clean environment
2. Keep test audio files small and specific
3. Use meaningful and consistent test messages
4. Capture screenshots at key steps of the test
5. Log detailed information for easier debugging

---

For more detailed information, refer to the full-e2e-test-guide.md in the test package.