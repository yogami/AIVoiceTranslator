# AIVoiceTranslator: Real-time Classroom Translation System

AIVoiceTranslator is an intelligent multilingual communication platform for educational environments. It captures a teacher's speech, translates it to multiple languages in real-time, and delivers translations as audio streams to students in their preferred languages.

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

## Development Workflow

This project follows strict Test-Driven Development (TDD) practices. For all code changes:

1. Write tests first
2. Implement code to pass tests
3. Refactor while maintaining passing tests
4. Update testing infrastructure and metrics

For the complete development process, see [DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md).

## Testing

AIVoiceTranslator includes a comprehensive suite of tests to ensure reliability:

### Automated CI/CD Testing

The project includes CI/CD integration with GitHub Actions, which can be triggered directly from Replit:

1. **One-Time Setup**:
   - Create a GitHub repository
   - Push code to the GitHub repository
   - Generate a GitHub Personal Access Token with `repo` scope
   - Add the token in Replit Secrets as `GITHUB_TOKEN`
   - Add your OpenAI API Key in GitHub Secrets as `OPENAI_API_KEY`
   - Update `ci-cd-trigger.sh` with your GitHub username and repository name

2. **Run the CI/CD Pipeline**:
   ```
   chmod +x ci-cd-trigger.sh
   ./ci-cd-trigger.sh
   ```

This will:
- Push your latest code to GitHub
- Trigger automated tests in GitHub Actions
- Deploy to your Replit app URL
- Run Selenium browser tests against the deployed app
- Display a link to view test results

For detailed information about the Selenium testing setup, see the [SELENIUM-TESTING.md](SELENIUM-TESTING.md) document.

### Local Testing

Run the local test suite:

```
./test-websocket.sh             # Test WebSocket client/server communication
./test-metrics.sh               # Test metrics API functionality
./tests/run-tts-selection-tests.sh  # Test TTS service selection functionality
./tests/run-tts-service-suite.sh    # Run all TTS service-related tests
```

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

- **Selenium Tests**: End-to-end browser tests verifying UI functionality
- **Integration Tests**: Tests the entire app flow with mocked components 
- **WebSocket Tests**: Tests communication between clients and server
- **Speech Tests**: Tests real-time speech processing

Run Selenium tests locally with:

```
APP_URL=https://your-app-url.replit.app ./tests/run-selenium-tests.sh
```

Or run all tests with:

```
node run-all-tests.js
```

For more information on Selenium testing, see [SELENIUM-TESTING.md](SELENIUM-TESTING.md).

### Load Testing

The project includes specialized load tests to simulate real classroom environments with multiple simultaneous users:

- **Classroom Simulation**: A load test that simulates a teacher speaking German with 25 students listening in various languages
- **Performance Metrics**: Measures connection time, translation latency, and audio delivery success rate
- **Deployment Validation**: Helps verify system performance before staging/production deployments

Run load tests locally with:

```bash
# Run with default settings (25 students)
./run-load-tests.sh

# Run with custom server URL and student count
./run-load-tests.sh ws://your-server-url.com/ws 50
```

**Note**: These load tests are resource-intensive and not part of the regular CI/CD pipeline. They should only be run when preparing for staging/production deployments or when specifically testing system capacity.

Load tests can also be triggered manually in GitHub Actions via the "Classroom Load Test" workflow. This allows testing against staging environments with configurable parameters.

For detailed information about load testing, see [LOAD-TESTING.md](LOAD-TESTING.md).

## WebSocket Protocol

The application uses a custom WebSocket protocol for real-time communication:

- **Connection**: Initial connection with role and language information
- **Registration**: Update client role and language preference
- **Audio**: Send audio data from teacher to server
- **Translation**: Receive translations from server
- **Transcript Request**: Request historical transcripts

## License

[MIT License](LICENSE)