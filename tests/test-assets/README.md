# Test Audio Files

This directory contains audio files used for end-to-end testing of the AIVoiceTranslator application.

## Required Audio Files

- `test-audio-english.mp3` - A clear English voice recording saying "This is a test of the translation system"

## Creating Test Audio

You can create the test audio files using:

1. **Text-to-Speech Tools**:
   - Use https://ttsmp3.com/ or similar online TTS services
   - Use the command line tool `say` on macOS:
     ```
     say -o test-audio-english.mp3 -v "Alex" "This is a test of the translation system"
     ```
   - Use Google Cloud TTS or Amazon Polly 

2. **Record Yourself**:
   - Use any voice recording app
   - Speak clearly and at a moderate pace
   - Save as MP3 format

## Audio Format Requirements

- Format: MP3
- Duration: 2-5 seconds
- Sample Rate: 44.1 kHz
- Bit Rate: 128 kbps or higher

## Using Custom Test Phrases

If you want to use different test phrases, make sure to update the expected translations in `tests/selenium/audio-e2e-test.js`. Look for the section that checks for expected Spanish words in the translation.

## Automated Audio Tests

The audio E2E tests open two browsers:
1. A "teacher" browser that plays the audio file
2. A "student" browser that waits for the translation

The test is successful when the expected translated text appears in the student browser.