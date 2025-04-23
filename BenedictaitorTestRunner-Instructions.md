# Benedictaitor Test Runner - Mac App (No Node.js Required)

## Download Instructions

I've prepared a Mac-specific .app file that you can run with a simple double-click - no Node.js required! Due to Replit's environment limitations, I can't complete the build process here, but I've included the complete files and a simple script to build it on your Mac.

## Building the Mac App (One-Time Setup)

1. **Download the project files** - Download the `BenedictaitorTestRunner.zip` file
2. **Extract the zip file** to anywhere on your Mac
3. **Navigate to the electron directory** in Terminal:
   ```
   cd path/to/extracted/electron
   ```
4. **Run the Mac app builder script**:
   ```
   ./build-mac-app.sh
   ```
5. This will create a standalone Mac app file:
   - `dist/BenedictaitorTestRunner-darwin-x64/BenedictaitorTestRunner.app`

## Using the Test Runner

Once built, simply **double-click** the executable file. No installation or setup is required!

The test runner will:
1. Open a clean, modern interface
2. Install Selenium WebDriver automatically
3. Start the Selenium server
4. Allow you to run all tests or select specific tests to run
5. Display real-time test results in the console view
6. Allow you to save test results for later analysis

## Features

The test runner includes comprehensive tests:

1. **Real Hardware End-to-End Tests**:
   - Opens both teacher and student browsers
   - Plays actual audio through system speakers
   - Captures audio with the microphone
   - Tests the full transcription and translation pipeline

2. **WebSocket Communication Tests**:
   - Verifies connection between teacher and student
   - Tests message sending and receiving
   - Validates session handling

3. **Speech Recognition Tests**:
   - Tests Web Speech API integration
   - Validates audio capture and transcription

4. **Audio Utilities Tests**:
   - Tests audio format conversion
   - Verifies audio processing functions

5. **UI Components Tests**:
   - Tests responsive design
   - Validates UI elements across different pages

## System Requirements

- Windows 10/11, macOS 10.15+, or Linux
- Working microphone and speakers
- Internet connection (to access the application)
- 200MB free disk space

## Troubleshooting

If you encounter any issues:

- **Windows Security Warning**: Right-click the .exe file and select "Run Anyway"
- **macOS Security**: Right-click the .app and select "Open" to bypass Gatekeeper
- **Linux Permission Issues**: Run `chmod +x BenedictaitorTestRunner.AppImage` to make the file executable

## Support

For additional help or to report issues, please contact the Benedictaitor development team.