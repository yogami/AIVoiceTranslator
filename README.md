# AIVoiceTranslator: Real-time Classroom Translation System

AIVoiceTranslator is an intelligent multilingual communication platform designed specifically for educational environments. It captures a teacher's speech, translates it to multiple languages in real-time, and delivers translations as audio streams to students in their preferred languages.

## Project Overview

This project aims to break down language barriers in educational settings by providing real-time voice translation. A teacher speaks in their native language, and students can hear the content in their preferred language with minimal latency, preserving both semantic meaning and emotional tone.

### Core Features

- **Real-time Speech Processing**: Capture, process, and translate speech with minimal latency
- **Multilingual Support**: Currently supports English, Spanish, German, French, Chinese, Japanese, and more
- **Low-Latency Translation**: End-to-end latency under 2 seconds from speech to translated audio
- **WebSocket Architecture**: Fast, bidirectional communication for real-time updates
- **Intelligent Caching**: Optimizes performance by caching frequently used translations and audio
- **Persistent Translation Memory**: Stores translation history in PostgreSQL database
- **Adaptive Voice Technology**: Uses OpenAI's TTS for natural-sounding translations

## Technical Architecture

### Frontend
- **Main Interface**: HTML/CSS/JavaScript for teacher and student interfaces
- **Real-time Communication**: WebSocket client for bidirectional updates
- **Audio Processing**: Web Audio API for speech capture and playback
- **Mobile Support**: Responsive design with QR code access for students

### Backend
- **Server**: Node.js with Express
- **Real-time Communication**: WebSocket server for bidirectional messaging
- **Speech Processing**: OpenAI Whisper API for accurate transcription
- **Translation Engine**: OpenAI GPT-4 for high-quality contextual translations
- **Text-to-Speech**: OpenAI TTS for natural-sounding synthesized speech
- **Data Persistence**: PostgreSQL database for storing translation history

## Project Structure

```
AIVoiceTranslator/
├── client/                  # Client-side code
│   ├── index.html           # Main landing page
│   └── public/              # Static assets and HTML interfaces
│       ├── js/              # JavaScript libraries and utilities
│       ├── simple-student.html  # Simplified student interface
│       └── websocket-diagnostics.html  # WebSocket testing interface
│
├── server/                  # Server-side code
│   ├── config.ts            # Server configuration
│   ├── index.ts             # Main server entry point
│   ├── openai.ts            # OpenAI API integration
│   ├── openai-streaming.ts  # OpenAI streaming functionality
│   ├── routes.ts            # HTTP API routes
│   ├── storage.ts           # Database interface
│   ├── vite.ts              # Vite server configuration
│   ├── websocket.ts         # WebSocket server implementation
│   └── services/            # Core service implementations
│       ├── TextToSpeechService.ts  # TTS service
│       ├── TranslationService.ts   # Translation service
│       └── WebSocketServer.ts      # WebSocket server
│
├── shared/                  # Shared code between client and server
│   └── schema.ts            # Database schema definitions
│
├── audio-cache/             # Cached audio files
├── temp/                    # Temporary audio files
│
├── drizzle.config.ts        # Drizzle ORM configuration
├── package.json             # Project dependencies
├── tsconfig.json            # TypeScript configuration
└── vite.config.ts           # Vite configuration
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL database (if using persistent storage)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/AIVoiceTranslator.git
   cd AIVoiceTranslator
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory with:
   ```
   OPENAI_API_KEY=your_openai_api_key
   DATABASE_URL=postgresql://username:password@localhost:5432/aivoicetranslator
   ```

4. Initialize the database:
   ```bash
   npm run db:push
   ```

5. Start the application:
   ```bash
   npm run dev
   ```

6. Open your browser and navigate to `http://localhost:5000`

## Database Schema

The application uses PostgreSQL with Drizzle ORM. The database schema includes:

- **Users**: Authentication information for admin access
- **Languages**: Supported languages and their settings
- **Translations**: Record of all translations performed
- **Transcripts**: Historical records of speech transcriptions

## Interface Guide

### Teacher Interface

The Teacher Interface allows instructors to:

1. Select their source language
2. Begin speaking with the "Start Recording" button
3. View real-time transcription of their speech
4. Monitor active student connections and their language selections
5. See performance metrics including latency and processing times

Access at: `/teacher`

### Student Interface

The Student Interface allows students to:

1. Select their preferred target language
2. Connect to the active teacher session
3. Receive real-time translations as both text and audio
4. Adjust volume and playback settings
5. Access translation history

Two versions are available:
- Standard: `/student`
- Simplified: `/simple-student.html` (optimized for mobile devices)

### WebSocket Diagnostics

A diagnostic interface for testing WebSocket connections and TTS settings:

- Monitor WebSocket connection status
- Test different TTS voices and settings
- View performance metrics

Access at: `/websocket-diagnostics.html`

## WebSocket Protocol

The application uses a custom WebSocket protocol with these message types:

### Client to Server

- **Register**: `{ type: "register", role: "teacher|student", language: "en-US" }`
- **Audio**: `{ type: "audio", audio: "base64EncodedAudio", isFirstChunk: boolean }`
- **GetTranslation**: `{ type: "getTranslation", text: "Text to translate", sourceLanguage: "en-US", targetLanguage: "es-ES" }`
- **TranscriptRequest**: `{ type: "transcriptRequest", sessionId: "session-id" }`

### Server to Client

- **Translation**: `{ type: "translation", originalText: "Original", translatedText: "Translated", sourceLanguage: "en-US", targetLanguage: "es-ES", audioBase64: "base64EncodedAudio" }`
- **Transcription**: `{ type: "transcription", text: "Transcribed text", isFinal: boolean, languageCode: "en-US" }`
- **Error**: `{ type: "error", message: "Error message" }`
- **Transcript**: `{ type: "transcript", entries: [...] }`

## Performance Considerations

### Latency Optimization

The system is optimized for low latency with these features:

- Audio streaming for real-time processing
- Intelligent caching of translations and TTS audio
- Concurrent processing of multiple translation requests
- Optimized WebSocket communication

Current end-to-end latency metrics:
- Speech to text: ~0.5-1.0 seconds
- Translation: ~0.3-0.5 seconds
- Text to speech: ~0.5-1.5 seconds
- Total latency: ~1.5-3.0 seconds (depending on phrase complexity)

### Scaling Considerations

The system has been load tested and can handle:
- Up to 25 simultaneous student connections per server instance
- Multiple language pairs simultaneously
- Continuous translation for 60+ minutes

## Environment Variables

- `OPENAI_API_KEY`: Required for OpenAI API access
- `DATABASE_URL`: PostgreSQL connection string
- `PORT`: Server port (default: 5000)
- `NODE_ENV`: Environment setting (development/production)

## Development Guidelines

### Adding New Languages

1. Update the language support in `client/public/js/language-support.js`
2. Test transcription accuracy with sample audio
3. Verify TTS voice quality for the new language

### Adding Database Support

If you need to modify the database schema:

1. Update the schema definitions in `shared/schema.ts`
2. Run `npm run db:push` to apply changes to the database

### Mobile Device Support

The application includes QR code generation for easy mobile access:
- QR codes are automatically generated for the student interface
- Mobile-optimized interface adapts to smaller screens

## License

[MIT License](LICENSE)