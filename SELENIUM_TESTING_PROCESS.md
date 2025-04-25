# Selenium Testing Process for AIVoiceTranslator

## CI/CD Environment vs. Replit

When asked to run "Selenium end-to-end tests", this **always implies the CI/CD environment** and not Replit. Replit has limitations for browser automation, especially for audio-related functionality.

## Test Environment Setup 

### CI/CD Environment Requirements
- Chrome and Firefox WebDrivers installed
- Audio capabilities enabled in headless mode
- Network access for WebSocket connections
- Proper audio codecs and libraries
- Sufficient resources for parallel browser instances

### Running Tests in CI/CD

1. CI/CD pipeline starts the application server
2. Selenium tests are executed against the running server
3. Test results are collected and reported
4. Screenshots/videos are captured on failures

## End-to-End Test Categories

### Connection Tests
- Verify teacher and student can connect simultaneously
- Test WebSocket reconnection mechanisms
- Validate session management

### TTS Service Selection Tests
- Verify teacher can select different TTS services (Browser, OpenAI, Silent)
- Confirm selection is properly propagated to student interfaces
- Validate the correct audio is generated based on selection

### Audio Processing Tests
- Test audio recording and transmission
- Verify speech-to-text functionality
- Validate text-to-speech with different service types

### Translation Tests
- Verify correct translation between languages
- Test with various language pairs
- Validate special character handling

## Test Data Management

- Use predefined test messages
- Leverage recorded audio samples for consistency
- Avoid dependency on external services where possible

## Headless Browser Configuration

```javascript
// Example Chrome configuration for audio testing in headless mode
const options = new chrome.Options()
  .addArguments('--use-fake-ui-for-media-stream')
  .addArguments('--use-fake-device-for-media-stream')
  .addArguments('--allow-file-access-from-files')
  .addArguments('--no-sandbox')
  .addArguments('--disable-dev-shm-usage')
  .addArguments('--autoplay-policy=no-user-gesture-required');

// For CI/CD headless mode
options.addArguments('--headless=new');
```

## Common Issues & Solutions

### Audio Not Playing in Headless Mode
- Ensure proper Chrome flags for audio autoplay
- Use fake media devices for testing

### WebSocket Connection Issues
- Add proper wait times for connection establishment
- Implement retry mechanisms

### Browser Synchronization Problems
- Use explicit and implicit waits appropriately
- Implement custom wait conditions for WebSocket events

## Best Practices

1. Make tests independent and idempotent
2. Use page object pattern for maintainability
3. Implement proper cleanup procedures
4. Add detailed logging for troubleshooting
5. Capture screenshots/videos for failed tests
6. Use stable element selectors (IDs, data attributes)
7. Retry flaky tests automatically

## Important Notes

- Never run resource-intensive Selenium tests within Replit
- Use mocks for external services in CI/CD when appropriate
- Consider using Playwright as an alternative to Selenium for modern features