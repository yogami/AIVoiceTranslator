# Benedicataitor Student Interface - Quick Start Guide

This guide will help you quickly get started with the Benedicataitor Student Interface.

## Contents

1. Files in this package
2. Simple setup instructions
3. Testing with the included test server
4. Integrating with your Java backend
5. Troubleshooting

## 1. Files in this Package

- `index.html` - The main HTML file for the student interface
- `js/client.js` - The JavaScript client for WebSocket connection and audio handling
- `README.md` - Detailed documentation about the interface and integration
- `QUICK-START.md` - This quick start guide
- `test-server.js` - A simple Node.js WebSocket server for testing

## 2. Simple Setup Instructions

1. **Open the Student Interface:**
   - Simply open the `index.html` file in any modern web browser
   - No web server is required for basic testing

2. **Configure the WebSocket URL:**
   - Enter your WebSocket server URL (default is `ws://localhost:3000/ws`)
   - Click "Connect" to establish a connection

3. **Select a Language:**
   - Choose your preferred language from the dropdown
   - Click "Set Language" to register with the server

4. **Enable Audio:**
   - Click "Play Audio" to enable audio playback when audio chunks are received

## 3. Testing with the Included Test Server

The package includes a simple Node.js WebSocket server for testing:

1. **Install Node.js:**
   - Download and install Node.js from https://nodejs.org/

2. **Install WebSocket Library:**
   - Open a terminal/command prompt
   - Navigate to the directory containing `test-server.js`
   - Run: `npm install ws`

3. **Start the Test Server:**
   - Run: `node test-server.js`
   - You should see: "Benedicataitor Test Server started on ws://localhost:3000/ws"

4. **Connect from the Student Interface:**
   - Open `index.html` in a browser
   - Keep the default WebSocket URL (`ws://localhost:3000/ws`)
   - Click "Connect"
   - Select a language and click "Set Language"
   - The test server will automatically send test translations and audio

## 4. Integrating with Your Java Backend

1. **WebSocket Endpoint:**
   - Implement a WebSocket endpoint in your Java application
   - Use the JSR 356 API or a library like Tyrus

2. **Message Format:**
   - Follow the message format described in the README.md file
   - Ensure JSON messages are properly formatted

3. **Audio Format:**
   - Convert audio to PCM or MP3 format
   - Base64 encode the audio data before sending
   - Break audio into small chunks (1-3 seconds) for real-time playback

4. **Sample Code:**
   - See the README.md file for sample Java code for the WebSocket endpoint

## 5. Troubleshooting

**Connection Issues:**
- Verify the WebSocket server is running
- Check that the WebSocket URL is correct (including protocol, host, port, and path)
- Ensure there are no network restrictions or firewalls blocking the connection

**Audio Issues:**
- Check browser console for any audio decoding errors
- Verify audio format is compatible with Web Audio API
- Test with different audio formats or encodings
- Make sure audio chunks are properly base64 encoded

**Browser Compatibility:**
- The interface works best with modern browsers (Chrome, Firefox, Edge, Safari)
- If issues occur, try a different browser
- Check browser console for any JavaScript errors

**CORS Issues:**
- If the WebSocket server is on a different domain, ensure CORS is properly configured
- For local testing, this is usually not an issue

For more detailed information, refer to the README.md file or contact the developer for assistance.

---

Remember, this is a standalone client that can connect to any WebSocket server following the protocol described in the documentation. Customize it as needed for your specific requirements.