# Benedictaitor Test Runner

This standalone application allows you to run end-to-end tests for the Benedictaitor real-time translation system.

## Features

- **Real Hardware End-to-End Testing**: Tests the full audio capture → transcription → translation pipeline
- **No Setup Required**: Double-click to run, no IDE or developer tools needed
- **Built-in Selenium**: Automatically installs and runs all browser automation tools
- **Comprehensive Test Suite**: Tests WebSockets, speech recognition, audio utilities, and UI components

## How to Use

1. Download the executable for your operating system (Windows, macOS, or Linux)
2. Double-click to run the application
3. Follow the on-screen instructions:
   - Click "Install Selenium" to set up the testing environment
   - Click "Start Selenium Server" to begin the Selenium server
   - Select and run tests individually or run all tests

## Test Types

1. **WebSocket Tests**: Verify real-time communication between teacher and student interfaces
2. **End-to-End Selenium Tests**: Test the complete application flow with browser automation
3. **Speech Recognition Tests**: Verify audio capture and speech-to-text functionality
4. **Audio Utilities Tests**: Test audio processing and conversion
5. **UI Components Tests**: Verify UI elements and responsive design

## Testing with Real Audio

The "Real Hardware Test" uses your computer's:
- Speaker to play test audio samples
- Microphone to capture the audio
- Browser to process and transcribe the speech
- WebSocket to send the transcription to the server
- Second browser to receive and display the translation

This approach tests the entire pipeline in real-world conditions without mocking.

## Requirements

- Working speakers and microphone
- Internet connection (to access the Benedictaitor application)
- Permissions to run executable files
- About 200MB of free disk space

## Troubleshooting

- **Permission Issues**: Right-click the app and select "Run as Administrator" (Windows) or adjust security settings (macOS)
- **Audio Not Working**: Ensure your microphone and speakers are properly connected and working
- **Browser Not Starting**: The application will download Chrome WebDriver automatically. If it fails, check your firewall settings

## Support

If you encounter any issues or have questions, please contact the Benedictaitor development team.