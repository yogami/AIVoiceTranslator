# Benedicataitor Student Interface

This is a standalone browser-based student interface for the Benedicataitor application. It connects to a WebSocket server to receive translated text and audio chunks.

## Features

- Connects to any WebSocket server
- Language selection for translation
- Displays original and translated text
- Plays audio chunks streamed over WebSocket
- Volume control
- Simple, responsive UI

## Integration Guide

### Prerequisites

- A WebSocket server endpoint that can handle student connections
- The server should be able to send text translations and audio chunks

### Files in this Package

- `index.html`: The main HTML file for the student interface
- `js/client.js`: The JavaScript client that handles WebSocket connection and audio playback

### WebSocket Protocol

This client expects the following message formats:

#### Client to Server:

1. **Registration Message**:
   ```json
   {
     "type": "register",
     "role": "student",
     "languageCode": "es"  // Language code (es, fr, de, etc.)
   }
   ```

#### Server to Client:

1. **Connection Confirmation**:
   ```json
   {
     "type": "connection_confirmed",
     "sessionId": "unique_session_id"
   }
   ```

2. **Translation Message**:
   ```json
   {
     "type": "translation",
     "original": "Original text in English",
     "translated": "Translated text in target language"
   }
   ```

3. **Audio Chunk Message**:
   ```json
   {
     "type": "audio_chunk",
     "data": "base64_encoded_audio_data"
   }
   ```

4. **Error Message**:
   ```json
   {
     "type": "error",
     "error": "Error message"
   }
   ```

### Audio Format Requirements

- Audio chunks should be base64-encoded PCM or MP3 audio data
- The Web Audio API will attempt to decode the audio chunks
- Small chunks (1-3 seconds) work best for real-time playback

### Integration Steps

1. **Configure WebSocket URL**:
   - Set the WebSocket URL in the interface to point to your server
   - Default is `ws://localhost:3000/ws`

2. **Language Selection**:
   - The interface supports multiple languages
   - The language code is sent to the server during registration

3. **Audio Handling**:
   - Audio is automatically queued and played when received
   - Base64-encoded audio chunks are decoded and played sequentially

### Java Server Implementation Tips

1. **WebSocket Server**:
   - Use Java WebSocket API (JSR 356) or a library like Tyrus
   - Configure CORS if needed for browser connections

2. **Sample WebSocket Endpoint**:
   ```java
   @ServerEndpoint("/ws")
   public class BenedicataitorEndpoint {
       @OnOpen
       public void onOpen(Session session) {
           // Handle new connection
           session.getBasicRemote().sendText(
               "{\"type\":\"connection_confirmed\",\"sessionId\":\"" + 
               session.getId() + "\"}"
           );
       }
       
       @OnMessage
       public void onMessage(String message, Session session) {
           // Parse message as JSON and handle accordingly
           // For registration, store language preference
       }
       
       // Method to send translation to student
       public void sendTranslation(Session session, String original, String translated) {
           session.getBasicRemote().sendText(
               "{\"type\":\"translation\",\"original\":\"" + original + 
               "\",\"translated\":\"" + translated + "\"}"
           );
       }
       
       // Method to send audio chunk to student
       public void sendAudioChunk(Session session, byte[] audioData) {
           String base64Audio = Base64.getEncoder().encodeToString(audioData);
           session.getBasicRemote().sendText(
               "{\"type\":\"audio_chunk\",\"data\":\"" + base64Audio + "\"}"
           );
       }
   }
   ```

3. **Audio Processing**:
   - Generate audio chunks from your TTS system
   - Convert to appropriate format (PCM or MP3)
   - Base64 encode before sending over WebSocket

## Customization

You can customize the interface by modifying:

- CSS styles in the `<style>` section of `index.html`
- Supported languages in the `<select>` element in `index.html`
- Audio handling logic in `client.js`

## Testing

To test the interface:

1. Open `index.html` in a browser
2. Enter your WebSocket server URL
3. Click "Connect"
4. Select a language and click "Set Language"
5. When audio is received, click "Play Audio"

If you need to test without a server, you can create a simple testing server using Node.js and the `ws` library.

## Browser Compatibility

The interface works with modern browsers that support:
- WebSockets
- Web Audio API
- ES6 JavaScript

Tested on:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+