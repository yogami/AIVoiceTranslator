/**
 * Benedicataitor Student Interface
 * 
 * A standalone browser-based client for connecting to a WebSocket server
 * that streams translated text and audio chunks.
 */

class BenedicataitorClient {
    constructor() {
        this.socket = null;
        this.audioContext = null;
        this.audioEnabled = false;
        this.audioQueue = [];
        this.isPlayingAudio = false;
        this.sessionId = null;
        this.volume = 0.5;
        this.languageCode = null;
        this.pendingAudioChunks = [];
        this.audioSource = null;

        // DOM Elements
        this.elements = {
            serverUrl: document.getElementById('serverUrl'),
            connectButton: document.getElementById('connectButton'),
            disconnectButton: document.getElementById('disconnectButton'),
            statusIndicator: document.getElementById('statusIndicator'),
            connectionStatus: document.getElementById('connectionStatus'),
            connectionInfo: document.getElementById('connectionInfo'),
            sessionIdDisplay: document.getElementById('sessionId'),
            languageSelector: document.getElementById('languageSelector'),
            registerButton: document.getElementById('registerButton'),
            originalText: document.getElementById('originalText'),
            translatedText: document.getElementById('translatedText'),
            audioToggle: document.getElementById('audioToggle'),
            audioToggleText: document.getElementById('audioToggleText'),
            volumeSlider: document.getElementById('volumeSlider'),
            audioStatus: document.getElementById('audioStatus'),
            audioMessage: document.getElementById('audioMessage')
        };

        // Initialize event listeners
        this.initEventListeners();
    }

    initEventListeners() {
        this.elements.connectButton.addEventListener('click', () => this.connect());
        this.elements.disconnectButton.addEventListener('click', () => this.disconnect());
        this.elements.registerButton.addEventListener('click', () => this.registerLanguage());
        this.elements.audioToggle.addEventListener('click', () => this.toggleAudio());
        this.elements.volumeSlider.addEventListener('input', (e) => {
            this.volume = parseFloat(e.target.value);
            this.showAudioMessage(`Volume set to ${Math.round(this.volume * 100)}%`);
        });
    }

    connect() {
        if (this.socket) {
            this.disconnect();
        }

        const url = this.elements.serverUrl.value.trim();
        if (!url) {
            alert('Please enter a valid WebSocket server URL');
            return;
        }

        this.updateConnectionStatus('connecting', 'Connecting...');

        try {
            this.socket = new WebSocket(url);
            
            this.socket.onopen = () => {
                this.updateConnectionStatus('connected', 'Connected');
                this.elements.connectButton.disabled = true;
                this.elements.disconnectButton.disabled = false;
                this.elements.registerButton.disabled = false;
                this.initializeAudioContext();
            };

            this.socket.onclose = (event) => {
                console.log('WebSocket closed:', event);
                this.updateConnectionStatus('disconnected', 'Disconnected');
                this.resetConnectionState();
            };

            this.socket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.updateConnectionStatus('disconnected', 'Connection Error');
                this.showAudioMessage('WebSocket connection error', true);
                this.resetConnectionState();
            };

            this.socket.onmessage = (event) => this.handleMessage(event);
        } catch (error) {
            console.error('Failed to create WebSocket:', error);
            this.updateConnectionStatus('disconnected', 'Connection Failed');
            alert(`Failed to connect: ${error.message}`);
        }
    }

    disconnect() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        this.resetConnectionState();
    }

    resetConnectionState() {
        this.sessionId = null;
        this.elements.connectButton.disabled = false;
        this.elements.disconnectButton.disabled = true;
        this.elements.registerButton.disabled = true;
        this.elements.audioToggle.disabled = true;
        this.elements.connectionInfo.classList.add('hidden');
        this.elements.audioStatus.textContent = 'Audio is disabled. Connect to the server first.';
        
        // Clear any displayed content
        this.elements.originalText.innerHTML = '<p><em>Original text will appear here...</em></p>';
        this.elements.translatedText.innerHTML = '<p><em>Translated text will appear here...</em></p>';
        
        // Reset audio state
        this.audioEnabled = false;
        this.audioQueue = [];
        this.pendingAudioChunks = [];
        this.updateAudioToggleState();
    }

    updateConnectionStatus(state, message) {
        this.elements.statusIndicator.className = 'status-indicator ' + state;
        this.elements.connectionStatus.textContent = message;
    }

    registerLanguage() {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            alert('Not connected to server');
            return;
        }

        const languageCode = this.elements.languageSelector.value;
        this.languageCode = languageCode;
        
        const registerMessage = {
            type: 'register',
            role: 'student',
            languageCode: languageCode
        };
        
        this.socket.send(JSON.stringify(registerMessage));
        this.showAudioMessage(`Language set to ${this.getLanguageName(languageCode)}`);
    }

    getLanguageName(code) {
        const languages = {
            'es': 'Spanish',
            'fr': 'French',
            'de': 'German',
            'it': 'Italian',
            'zh': 'Chinese',
            'ja': 'Japanese',
            'ko': 'Korean',
            'ru': 'Russian',
            'ar': 'Arabic'
        };
        return languages[code] || code;
    }

    handleMessage(event) {
        try {
            const message = JSON.parse(event.data);
            console.log('Received message:', message);
            
            switch (message.type) {
                case 'connection_confirmed':
                    this.handleConnectionConfirmation(message);
                    break;
                case 'translation':
                    this.handleTranslation(message);
                    break;
                case 'audio_chunk':
                    this.handleAudioChunk(message);
                    break;
                case 'error':
                    this.handleError(message);
                    break;
                default:
                    console.log('Unknown message type:', message.type);
            }
        } catch (error) {
            console.error('Error parsing message:', error, event.data);
        }
    }

    handleConnectionConfirmation(message) {
        this.sessionId = message.sessionId;
        this.elements.sessionIdDisplay.textContent = this.sessionId;
        this.elements.connectionInfo.classList.remove('hidden');
        this.elements.audioToggle.disabled = false;
        this.elements.audioStatus.textContent = 'Audio ready. Click Play Audio to enable.';
    }

    handleTranslation(message) {
        if (message.original) {
            this.elements.originalText.innerHTML = `<p>${message.original}</p>`;
        }
        
        if (message.translated) {
            this.elements.translatedText.innerHTML = `<p>${message.translated}</p>`;
        }
    }

    async handleAudioChunk(message) {
        if (!message.data) {
            console.warn('Received audio_chunk message without data');
            return;
        }

        try {
            // Convert base64 to ArrayBuffer
            const binaryString = atob(message.data);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            this.pendingAudioChunks.push(bytes.buffer);
            
            // If audio is enabled, process the audio chunk
            if (this.audioEnabled) {
                if (this.pendingAudioChunks.length === 1) {
                    // Start processing audio if this is the first chunk
                    this.processNextAudioChunk();
                }
            }
        } catch (error) {
            console.error('Error processing audio chunk:', error);
        }
    }

    async processNextAudioChunk() {
        if (!this.audioContext || !this.audioEnabled || this.pendingAudioChunks.length === 0) {
            return;
        }

        try {
            const audioBuffer = this.pendingAudioChunks.shift();
            this.showAudioMessage('Playing audio...');
            
            // Decode audio data
            const audioData = await this.audioContext.decodeAudioData(audioBuffer);
            
            // Create audio source
            const source = this.audioContext.createBufferSource();
            source.buffer = audioData;
            
            // Create gain node for volume control
            const gainNode = this.audioContext.createGain();
            gainNode.gain.value = this.volume;
            
            // Connect nodes
            source.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            // Play the audio
            this.audioSource = source;
            
            source.onended = () => {
                this.audioSource = null;
                // Process next chunk if there are more
                if (this.pendingAudioChunks.length > 0) {
                    this.processNextAudioChunk();
                } else {
                    this.showAudioMessage('Audio playback complete');
                }
            };
            
            source.start(0);
        } catch (error) {
            console.error('Error playing audio chunk:', error);
            this.showAudioMessage('Error playing audio chunk', true);
            
            // Try to continue with the next chunk
            if (this.pendingAudioChunks.length > 0) {
                this.processNextAudioChunk();
            }
        }
    }

    handleError(message) {
        console.error('Server error:', message.error);
        this.showAudioMessage(`Server error: ${message.error}`, true);
    }

    initializeAudioContext() {
        try {
            // Create AudioContext only if it doesn't exist
            if (!this.audioContext) {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                this.audioContext = new AudioContext();
                
                if (this.audioContext.state === 'suspended') {
                    this.elements.audioStatus.textContent = 'Audio is suspended. Click Play Audio to enable.';
                }
            }
        } catch (error) {
            console.error('Failed to initialize AudioContext:', error);
            this.elements.audioStatus.textContent = 'Your browser does not support Web Audio API.';
            this.elements.audioToggle.disabled = true;
        }
    }

    toggleAudio() {
        this.audioEnabled = !this.audioEnabled;
        this.updateAudioToggleState();
        
        if (this.audioEnabled) {
            // Resume AudioContext if it's suspended
            if (this.audioContext && this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
            
            this.elements.audioStatus.textContent = 'Audio is enabled. Waiting for audio...';
            this.showAudioMessage('Audio playback enabled');
            
            // Start processing any pending audio chunks
            if (this.pendingAudioChunks.length > 0 && !this.audioSource) {
                this.processNextAudioChunk();
            }
        } else {
            this.elements.audioStatus.textContent = 'Audio is disabled. Click Play Audio to enable.';
            this.showAudioMessage('Audio playback disabled');
            
            // Stop any currently playing audio
            if (this.audioSource) {
                this.audioSource.stop();
                this.audioSource = null;
            }
        }
    }

    updateAudioToggleState() {
        this.elements.audioToggleText.textContent = this.audioEnabled ? 'Pause Audio' : 'Play Audio';
    }

    showAudioMessage(message, isError = false) {
        this.elements.audioMessage.textContent = message;
        this.elements.audioMessage.style.color = isError ? 'var(--error)' : 'var(--success)';
        this.elements.audioMessage.classList.remove('hidden');
        
        // Clear message after a few seconds
        setTimeout(() => {
            this.elements.audioMessage.classList.add('hidden');
        }, 3000);
    }
}

// Initialize the client when the page is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.benedicataitorClient = new BenedicataitorClient();
});