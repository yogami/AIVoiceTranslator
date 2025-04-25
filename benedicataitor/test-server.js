/**
 * Test WebSocket Server for Benedicataitor
 * 
 * This simple WebSocket server can be used to test the Benedicataitor student interface.
 * It accepts connections, handles registration, and can simulate sending translations and audio.
 * 
 * Usage:
 * 1. Install Node.js
 * 2. Run: npm install ws
 * 3. Run: node test-server.js
 * 4. Connect to ws://localhost:3000/ws from the student interface
 */

const WebSocket = require('ws');

// Create a WebSocket server
const wss = new WebSocket.Server({ port: 3000, path: '/ws' });

// Keep track of connected clients and their language preferences
const clients = new Map();

console.log('Benedicataitor Test Server started on ws://localhost:3000/ws');

// Handle WebSocket connections
wss.on('connection', (ws, req) => {
    const clientId = generateSessionId();
    
    // Store client info
    clients.set(ws, {
        id: clientId,
        languageCode: null,
        role: null
    });
    
    console.log(`New client connected: ${clientId}`);
    
    // Send connection confirmation
    ws.send(JSON.stringify({
        type: 'connection_confirmed',
        sessionId: clientId
    }));
    
    // Handle messages from client
    ws.on('message', (message) => {
        try {
            const parsedMessage = JSON.parse(message.toString());
            console.log(`Received message from ${clientId}:`, parsedMessage);
            
            if (parsedMessage.type === 'register') {
                // Update client info with registration data
                const clientInfo = clients.get(ws);
                clientInfo.role = parsedMessage.role;
                clientInfo.languageCode = parsedMessage.languageCode;
                clients.set(ws, clientInfo);
                
                console.log(`Client ${clientId} registered as ${parsedMessage.role} with language ${parsedMessage.languageCode}`);
                
                // Send a test translation after registration
                setTimeout(() => {
                    sendTestTranslation(ws, parsedMessage.languageCode);
                }, 1000);
                
                // Send a test audio chunk after registration
                setTimeout(() => {
                    sendTestAudio(ws);
                }, 2000);
            }
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });
    
    // Handle client disconnection
    ws.on('close', () => {
        console.log(`Client disconnected: ${clientId}`);
        clients.delete(ws);
    });
});

// Generate a random session ID
function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
}

// Send a test translation to the client
function sendTestTranslation(ws, languageCode) {
    const originalText = "Hello, welcome to Benedicataitor! This is a test message to demonstrate real-time translation capabilities.";
    
    // Simulate translations for different languages
    const translations = {
        'es': "Hola, ¡bienvenido a Benedicataitor! Este es un mensaje de prueba para demostrar las capacidades de traducción en tiempo real.",
        'fr': "Bonjour, bienvenue à Benedicataitor ! Ceci est un message test pour démontrer les capacités de traduction en temps réel.",
        'de': "Hallo, willkommen bei Benedicataitor! Dies ist eine Testnachricht, um die Echtzeit-Übersetzungsfähigkeiten zu demonstrieren.",
        'it': "Ciao, benvenuto in Benedicataitor! Questo è un messaggio di prova per dimostrare le capacità di traduzione in tempo reale.",
        'zh': "你好，欢迎来到Benedicataitor！这是一条测试消息，用于演示实时翻译功能。",
        'ja': "こんにちは、Benedicataitorへようこそ！これはリアルタイム翻訳機能を示すためのテストメッセージです。",
        'ko': "안녕하세요, Benedicataitor에 오신 것을 환영합니다! 이것은 실시간 번역 기능을 보여주기 위한 테스트 메시지입니다.",
        'ru': "Здравствуйте, добро пожаловать в Benedicataitor! Это тестовое сообщение, демонстрирующее возможности перевода в реальном времени.",
        'ar': "مرحبًا ، مرحبًا بك في Benedicataitor! هذه رسالة اختبار لإظهار قدرات الترجمة في الوقت الفعلي."
    };
    
    const translatedText = translations[languageCode] || originalText;
    
    ws.send(JSON.stringify({
        type: 'translation',
        original: originalText,
        translated: translatedText
    }));
    
    console.log(`Sent test translation to client in ${languageCode}`);
}

// Send a test audio chunk to the client
// This uses a pre-encoded audio sample
function sendTestAudio(ws) {
    // This is a very short base64-encoded audio sample (beep sound)
    const audioSampleBase64 = "UklGRpQHAABXQVZFZm10IBAAAAABAAEARKwAAESsAAABAAgAZGF0YXAHAACAgICAgICAgICAgICAgICAgICAgICAgICAf3hxeH+AfXZ1eHx6dnR5fXtzeXJzdHVvcnN5cG9+gXJwgoVycIWMdnWHjH5+h4eBgYWHg4GDhIKAgYKBfn+BgHt9f314en16eXl8e3p4e3x7enl7fXl5eXx7eXh6e3p7e316fX58fHx9fn19fH1+fn1+fn9+f4CBgICBgoKBgIOFg4SDhISDgoODgYGBgoGAgICAfn5+fXx8fXx7e3t7e3t8e3x9f3t7f4F+f4KDgYGDhoWEhIeHh4aHiIiHh4iIhoaGhoSDg4OCgH9/fn17e3p5d3Z2dXRzcXJyc3JwcHFydHR3eHp6e36AgIKGiYuNj5OWmJqen6Kkpqipq66wsbCxs7Ozs7O0tLOysLCvrq2qqKalpqWjoaCfnZyampmXlZOSkpGPjYuKiomGhIKCgYB9e3p5eHd1c3Jxb25tbGtqaWdmZmVmZmVlZWZnaGlrbG1vcXN0d3p9f4GEh4qNkJKVl5qcnqChoqSlpqioqaqrrKysra2traysq6qop6alo6Oin52bmpmXlZSSkI+OjIqJiIaEg4GAgH57end2dXRzcXBubWxsamppaWhoaGhpaWprbG5vcXJ0dXh6fX+BhIaJi46Qk5SWmJqdnqChoaKjpKSlpaampqalpaSkpKOioaCfnp2cm5qYl5WUk5GPjYyLioiHhYSCgYB/fnx7enl3dnVzcnFwbm5tbGtramppampqa2tsbW5vcXJ0dXd5e31/gYOFiIqMj5GTlJaYmpudnp+goaGio6OjpKSkpKOjo6OioaGgnp6cm5qZl5aVk5KQj42LiomIhoWDgYCAfn18e3p4d3Z1c3Jxb25tbGtqaWlpaWlqampra2xubm9xcnR1eHl7foCChIaJi42PkZOVlpiZmpydnp+foKChoaGhoqKioaGhoaCfn56enZybmpmYlpWUkpGPjoyLioiHhYSCgYCAfn18e3p5d3Z1c3Jxb25ubWxsamppampqamtrbGxubm9xcnR1d3l7fX+BhIaIio2PkZOUlpeZmpydnp+fn6Cfn6CgoKCgoJ+fn5+enp2dnJuamZeWlZOSkJCOjYuKiIeGhIOBgIB+fXx7end2dXRycXBubWxsamppaWlpaWpqa2xsbW5vcXJ0dXd5e31/gYOFh4qMjo+RkpSVl5iZm5ydnZ6en5+fn5+fn6CgoJ+enp6enZybmpmYl5WUk5GQj42LioiHhoSCgYB/fnx7enl4dnVzcnFvcG5tbGtqaWlpaWlqamprbGxtbm9wcnN1d3l7fX+BhIaIi42OkJKTlJaXmZqbnJ2dnp6en5+fn5+fn5+enp6dnZ2cm5qZmJeWlJOSkI+OjIuKiIeGhIOCgH9+fXx6eXh3dXRzcnBvbm1sa2pqaWlpaWpqa2tsbG1ucHFydHV3eXt9f4GDhYeJi42OkJGTlJWXmJmanJycnZ2dnp6en56enp6enZ2dnJybmpmYl5aVlJKRkI6NjIuJiIaFg4KBgH9+fHt6eXh2dXRzcnFvbm5tbGtqamlpaWlqa2tsbG1ubm9xcnR1d3l7fH5/gYOFh4iKjI2PkJGTlJWWl5iZmZqampubm5ubm5ubm5qampmZmJiXlpWUk5KRkI+OjYuKiYiHhYWEgoGAf359fHt6eXh3dnV0c3JxcG5ubWxsa2tqampqa2trbGxtbm9vcXFydHV2d3l6fH1+gIGCg4WFhoiIiYqLjI2Njo+PkJCQkZGRkZGRkJCQj4+Oj46OjYyLi4qJiYiIh4aGhYSEg4KBgYB/f359fHx7e3p5eXh3d3Z2dXV0dHNzcnJxcXBwcG9vb25ubm5tbW1tbm5ub25vcHBwcXFycnJzdHR1dXV2dnZ3d3d4eHl5eXl6enp6enp6enp6enp6enp6eXl5eXl5eXh4eHh4d3d3d3d2dnZ2dnZ1dXV1dXV1dXV0dHR0dHRzc3Nzc3NycnJycnJycXFxcXFxcXFwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHFxcXFxcXFxcXFxcXFxcXFxcXJycnJycnJycnJycnJycnJycnJycnJyc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3NzcnJycnJycnJycnFxcXFxcXFxcXFwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcA==";
    
    // Send the audio chunk
    ws.send(JSON.stringify({
        type: 'audio_chunk',
        data: audioSampleBase64
    }));
    
    console.log(`Sent test audio chunk to client`);
}

// Set up an interval to send a new translation and audio every 10 seconds
setInterval(() => {
    clients.forEach((client, ws) => {
        if (client.languageCode) {
            sendTestTranslation(ws, client.languageCode);
            setTimeout(() => {
                sendTestAudio(ws);
            }, 1000);
        }
    });
}, 10000);