# Benedictaitor: Real-time Classroom Translation System

Benedictaitor is an intelligent multilingual communication platform for educational environments. It captures a teacher's speech, translates it to multiple languages in real-time, and delivers translations as audio streams to students in their preferred languages.

## Features

- Real-time speech capture and processing
- Multilingual support (English, Spanish, German, French, with more languages planned)
- Low-latency audio translation (under 2 seconds)
- WebSocket-based architecture for fast, bidirectional communication
- Comprehensive testing infrastructure for reliable operation

## Technical Architecture

- **Frontend**: React-based UI with WebSocket client
- **Backend**: Node.js with Express and WebSocket server
- **Speech Processing**: OpenAI Whisper API for transcription 
- **Translation**: OpenAI GPT-4 for high-quality translations
- **Text-to-Speech**: OpenAI TTS for natural-sounding synthesized speech

## Getting Started

1. Clone the repository
2. Install dependencies with `npm install`
3. Set up your environment variables (see below)
4. Start the application with `npm run dev`

## Environment Variables

Create a `.env` file with the following:

```
OPENAI_API_KEY=your_openai_api_key
```

## Testing

Benedictaitor includes a comprehensive suite of tests to ensure reliability:

### Real Hardware Testing

The most accurate way to test is with actual hardware in a real environment. This tests the complete audio pathway including microphones and speakers:

```
./run-real-hardware-test.sh
```

This test:
1. Opens a browser and navigates to the teacher interface
2. Plays test audio through your computer's speakers 
3. Records the audio with your microphone
4. Verifies the transcription accuracy

This provides a complete replacement for manual testing, simulating actual classroom usage.

### Other Tests

- **E2E Tests**: End-to-end tests using Selenium, Puppeteer, or Playwright
- **Integration Tests**: Tests the entire app flow with mocked components 
- **WebSocket Tests**: Tests communication between clients and server
- **Speech Tests**: Tests real-time speech processing

Run all tests with:

```
node run-all-tests.js
```

## WebSocket Protocol

The application uses a custom WebSocket protocol for real-time communication:

- **Connection**: Initial connection with role and language information
- **Registration**: Update client role and language preference
- **Audio**: Send audio data from teacher to server
- **Translation**: Receive translations from server
- **Transcript Request**: Request historical transcripts

## License

[MIT License](LICENSE)