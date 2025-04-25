# Test Assets Directory

This directory contains assets used for automated tests in the AIVoiceTranslator project.

## Audio Files

The `audio` directory contains audio files used for end-to-end audio testing:

- `test-audio-english.mp3`: A sample English audio recording saying "This is a test of the translation system"
- `test-audio-spanish.mp3`: A sample Spanish audio recording of the translated version
- `test-audio-french.mp3`: A sample French audio recording of the translated version
- `test-audio-german.mp3`: A sample German audio recording of the translated version

## Usage in Tests

These assets are used in the audio E2E tests to verify the complete audio capture, translation, and playback flow works correctly.

### How to Record New Test Audio Files

If you need to create new test audio files:

1. Use a tool like Audacity to record clear speech at 16kHz, mono format
2. Save as MP3 with reasonable quality (128kbps is sufficient)
3. Place the files in the `audio` directory
4. Update the test scripts to reference the new files

### Usage in CI/CD

The GitHub Actions workflow automatically uses these assets when running the audio E2E tests.