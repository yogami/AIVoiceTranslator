// TODO: [Technical Debt - Feature/Refactor]
// Consolidate language dropdown list from a single source of truth instead of being hardcoded in HTML.
// This applies to both teacher.html and student.html.

// TODO: [Technical Debt - Feature]
// Implement/fix the "Connected Students: <span id="studentCount">0</span>" display logic.
// This involves WebSocket messages from the server to update the count and potentially list.

console.log('[DEBUG] teacher.js: Top of file, script is being parsed.');

(function() {
    console.log('[DEBUG] teacher.js: IIFE executed.');
    const appState = {
        ws: null,
        isRecording: false,
        recognition: null, // webkitSpeechRecognition instance
        selectedLanguage: 'en-US', // Default language, will be updated from DOM
        mediaRecorder: null, // MediaRecorder for audio capture
        audioChunks: [], // Store audio chunks
        sessionId: null, // Session ID for audio streaming
        // connectedStudents: new Map(), // Not currently used, for future student list feature
    };

    const domElements = {
        languageSelect: null,
        classroomInfo: null,
        recordButton: null,
        statusDisplay: null,
        transcriptionDisplay: null,
        classroomCodeDisplay: null,
        studentUrlDisplay: null,
        qrCodeContainer: null,
        studentCountDisplay: null, // For future use
        studentsListDisplay: null, // For future use
    };

    const uiUpdater = {
        updateStatus: function(message, type) {
            if (domElements.statusDisplay) domElements.statusDisplay.textContent = message;
            // Potential: add/remove class based on type for styling errors, success, etc.
        },

        displayClassroomCode: function(code, expiresAt) {
            if (domElements.classroomCodeDisplay) domElements.classroomCodeDisplay.textContent = code;
            const studentUrl = `${window.location.origin}/student?code=${code}`;
            if (domElements.studentUrlDisplay) domElements.studentUrlDisplay.textContent = studentUrl;
            if (domElements.qrCodeContainer && typeof QRCode !== 'undefined') {
                domElements.qrCodeContainer.innerHTML = '';
                domElements.qrCodeContainer.style.display = 'block';
                new QRCode(domElements.qrCodeContainer, { text: studentUrl, width: 150, height: 150 });
            }
            if (expiresAt) {
                const expirationDate = new Date(expiresAt);
                console.log(`Classroom code ${code} expires at ${expirationDate.toLocaleTimeString()}`);
            }
        },

        addToTranscription: function(text) {
            if (domElements.transcriptionDisplay) {
                const timestamp = new Date().toLocaleTimeString();
                domElements.transcriptionDisplay.textContent += `[${timestamp}] ${text}\n`;
                domElements.transcriptionDisplay.scrollTop = domElements.transcriptionDisplay.scrollHeight;
            }
        },

        displayTranscription: function(text, isFinal) {
            // For now, only display final transcripts. Interim display can be added later.
            if (isFinal) {
                this.addToTranscription(text);
            }
        },

        setRecordButtonToRecording: function() {
            if(domElements.recordButton) {
                domElements.recordButton.textContent = 'Stop Recording';
                domElements.recordButton.classList.add('recording');
            }
        },

        setRecordButtonToStopped: function() {
            if (domElements.recordButton) {
                domElements.recordButton.textContent = 'Start Recording';
                domElements.recordButton.classList.remove('recording');
            }
        }
    };

    const webSocketHandler = {
        connect: function() {
            console.log('[DEBUG] teacher.js: webSocketHandler.connect called.');
            
            const viteWsUrlFromWindow = window.VITE_WS_URL;
            console.log('[DEBUG] teacher.js: Value of window.VITE_WS_URL is:', viteWsUrlFromWindow);

            if (!viteWsUrlFromWindow) {
                const errorMessage = 'CRITICAL ERROR: window.VITE_WS_URL is not defined. WebSocket cannot connect. Ensure Vite dev server is running and configured.';
                console.error(errorMessage);
                uiUpdater.updateStatus(errorMessage, 'error');
                if (domElements.studentUrlDisplay) domElements.studentUrlDisplay.textContent = 'Configuration Error!';
                return; // Stop further execution
            }

            const wsUrl = viteWsUrlFromWindow;
            uiUpdater.updateStatus('Connecting to server at ' + wsUrl + '...');
            
            try {
                appState.ws = new WebSocket(wsUrl);
                console.log('[DEBUG] teacher.js: WebSocket object created for URL:', wsUrl);
            } catch (e) {
                console.error('[DEBUG] teacher.js: Error creating WebSocket object:', e);
                uiUpdater.updateStatus('Error creating WebSocket connection: ' + e.message, 'error');
                return;
            }
            
            appState.ws.onopen = () => {
                console.log('[DEBUG] teacher.js: WebSocket onopen event fired.');
                uiUpdater.updateStatus('Connected to server');
                // Registration is now typically triggered by server's 'connection' message or explicitly
                // Let's explicitly call register after connection for teacher
                this.register(); 
            };
            appState.ws.onmessage = (event) => {
                console.log('[DEBUG] teacher.js: WebSocket onmessage event fired. Data:', event.data);
                this.handleMessage(event);
            }; // Use arrow function or .bind for correct 'this'
            appState.ws.onclose = (event) => {
                console.log('[DEBUG] teacher.js: WebSocket onclose event fired. Was clean:', event.wasClean, 'Code:', event.code, 'Reason:', event.reason);
                uiUpdater.updateStatus('Disconnected from server. Attempting to reconnect...');
                // Reconnect logic might need adjustment based on why it closed.
                // Avoid immediate aggressive reconnection if it was a config error.
                if (viteWsUrlFromWindow) { // Only attempt reconnect if the URL was initially valid
                    setTimeout(() => this.connect(), 5000); // Increased timeout
                }
            };
            appState.ws.onerror = (error) => {
                console.error('[DEBUG] teacher.js: WebSocket onerror event fired:', error);
                uiUpdater.updateStatus('WebSocket connection error.', 'error');
            };
        },

        register: function() {
            console.log('[DEBUG] teacher.js: webSocketHandler.register called.');
            if (appState.ws && appState.ws.readyState === WebSocket.OPEN) {
                const message = {
                    type: 'register',
                    role: 'teacher',
                    languageCode: appState.selectedLanguage
                };
                console.log('[DEBUG] teacher.js: Sending register message:', message);
                appState.ws.send(JSON.stringify(message));
            } else {
                console.warn('[DEBUG] teacher.js: WebSocket not open. Cannot send register message. State:', appState.ws ? appState.ws.readyState : 'null');
            }
        },

        handleMessage: function(event) {
            const data = JSON.parse(event.data);
            // console.log('[DEBUG] teacher.js: WebSocket onmessage event fired. Data:', event.data); // Original log for line 123

            switch (data.type) {
                case 'connection':
                    console.log('Connection message received:', data); // Original log for line 162
                    if (data.status === 'connected' && data.sessionId) {
                        appState.sessionId = data.sessionId;
                        console.log('Session ID received on connection:', appState.sessionId); // Original log for line 176
                    }
                    break;

                case 'register':
                    console.log('Register response received:', data); // Original log for line 185
                    if (data.status === 'success') {
                        uiUpdater.updateStatus('Registered as teacher', 'success');
                        console.log('Teacher registration successful:', data);
                        // Add any specific actions needed after successful teacher registration
                    } else {
                        const errorMessage = 'Registration failed: ' + (data.message || (data.data ? JSON.stringify(data.data) : 'Unknown reason'));
                        uiUpdater.updateStatus(errorMessage, 'error');
                        console.error('Registration failed:', data); // This was line 197, now correctly in the failure path
                    }
                    break;

                case 'classroom_code':
                    console.log('Classroom code message received:', data); // Original log for line 202
                    if (data.code) {
                        uiUpdater.displayClassroomCode(data.code, data.expiresAt); // Implied by line 54 log
                    }
                    break;

                case 'transcription': 
                    // console.log('Transcription message received:', data);
                    if (data.text) {
                        uiUpdater.displayTranscription(data.text, data.isFinal || false);
                    }
                    break;
 
                case 'error':
                    console.error('Error message from server:', data.message || data);
                    uiUpdater.updateStatus('Error: ' + (data.message || JSON.stringify(data)), 'error');
                    break;

                case 'ping':
                    // console.log('Ping received from server, sending pong.');
                    this.sendPong();
                    break;

                default: 
                    console.log('Unknown message type received by teacher:', data.type, data);
            }
        },

        sendTranscription: function(text) {
            if (appState.ws && appState.ws.readyState === WebSocket.OPEN) {
                const message = { type: 'transcription', text: text, timestamp: Date.now(), isFinal: true };
                appState.ws.send(JSON.stringify(message));
            }
        },

        sendAudioChunk: function(audioData, isFirstChunk = false, isFinalChunk = false) {
            if (appState.ws && appState.ws.readyState === WebSocket.OPEN && appState.sessionId) {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64Audio = reader.result.split(',')[1]; // Remove data:audio/webm;base64, prefix
                    const message = {
                        type: 'audio',
                        sessionId: appState.sessionId,
                        data: base64Audio,
                        isFirstChunk: isFirstChunk,
                        isFinalChunk: isFinalChunk,
                        language: appState.selectedLanguage
                    };
                    appState.ws.send(JSON.stringify(message));
                };
                reader.readAsDataURL(audioData);
            }
        },

        sendPong: function() {
            if (appState.ws && appState.ws.readyState === WebSocket.OPEN) {
                appState.ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            }
        }
    };

    const audioHandler = {
        setup: async function() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                
                // Create MediaRecorder for audio capture
                const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
                appState.mediaRecorder = new MediaRecorder(stream, { mimeType });
                
                let isFirstChunk = true;
                
                appState.mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        appState.audioChunks.push(event.data);
                        
                        // Send audio chunk immediately for real-time processing
                        if (appState.isRecording) {
                            webSocketHandler.sendAudioChunk(event.data, isFirstChunk, false);
                            isFirstChunk = false;
                        }
                    }
                };
                
                appState.mediaRecorder.onstop = () => {
                    // Send final chunk when recording stops
                    if (appState.audioChunks.length > 0) {
                        const audioBlob = new Blob(appState.audioChunks, { type: mimeType });
                        webSocketHandler.sendAudioChunk(audioBlob, false, true);
                    }
                    appState.audioChunks = [];
                };
                
                return true;
            } catch (error) {
                console.error('Error setting up audio capture:', error);
                uiUpdater.updateStatus('Microphone access denied or unavailable');
                return false;
            }
        },

        startRecording: function() {
            if (appState.mediaRecorder && appState.mediaRecorder.state === 'inactive') {
                appState.audioChunks = [];
                appState.mediaRecorder.start(100); // Capture in 100ms chunks for low latency
                console.log('Started audio recording');
            }
        },

        stopRecording: function() {
            if (appState.mediaRecorder && appState.mediaRecorder.state === 'recording') {
                appState.mediaRecorder.stop();
                console.log('Stopped audio recording');
            }
        }
    };

    const speechHandler = {
        setup: function() {
            if ('webkitSpeechRecognition' in window) {
                appState.recognition = new webkitSpeechRecognition();
                appState.recognition.continuous = true;
                appState.recognition.interimResults = true;
                appState.recognition.lang = domElements.languageSelect ? domElements.languageSelect.value : appState.selectedLanguage;
                
                appState.recognition.onresult = (event) => { // Arrow function for 'this' if we needed it (not in this version)
                    let finalTranscript = '';
                    for (let i = event.resultIndex; i < event.results.length; i++) {
                        if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
                    }
                    if (finalTranscript) {
                        // Send transcription for display purposes
                        webSocketHandler.sendTranscription(finalTranscript);
                        // Display locally as well
                        uiUpdater.displayTranscription(finalTranscript, true);
                    }
                };
                appState.recognition.onerror = (event) => {
                    console.error('Speech recognition error:', event.error);
                    uiUpdater.updateStatus('Speech recognition error: ' + event.error);
                };
                appState.recognition.onend = () => { // Arrow function for 'this'
                    if (appState.isRecording) this.start(); // Call internal start method
                };
            } else {
                uiUpdater.updateStatus('Speech recognition not supported in this browser');
            }
        },

        toggle: async function() {
            if (!appState.isRecording) {
                // Setup audio capture if not already done
                if (!appState.mediaRecorder) {
                    const audioSetup = await audioHandler.setup();
                    if (!audioSetup) {
                        return; // Failed to setup audio
                    }
                }
                this.start();
            } else {
                this.stop();
            }
        },

        start: function() {
            if (!appState.recognition) {
                uiUpdater.updateStatus('Speech recognition not available');
                return;
            }
            appState.isRecording = true;
            appState.recognition.lang = domElements.languageSelect ? domElements.languageSelect.value : appState.selectedLanguage;
            
            try {
                // Start speech recognition
                appState.recognition.start();
                // Start audio recording
                audioHandler.startRecording();
                
                uiUpdater.setRecordButtonToRecording();
                uiUpdater.updateStatus('Recording... Speak naturally');
            } catch (e) {
                console.error("Error starting recording:", e);
                uiUpdater.updateStatus('Error starting recording.');
                appState.isRecording = false; // Reset state
            }
        },

        stop: function() {
            appState.isRecording = false;
            
            // Stop speech recognition
            if (appState.recognition) {
                appState.recognition.stop();
            }
            
            // Stop audio recording
            audioHandler.stopRecording();
            
            uiUpdater.setRecordButtonToStopped();
            uiUpdater.updateStatus('Recording stopped');
        }
    };

    document.addEventListener('DOMContentLoaded', function main() {
        console.log('[DEBUG] teacher.js: DOMContentLoaded event fired.');
        // Initialize DOM element references
        domElements.languageSelect = document.getElementById('teacherLanguage');
        domElements.classroomInfo = document.getElementById('classroomInfo');
        domElements.recordButton = document.getElementById('recordButton');
        domElements.statusDisplay = document.getElementById('status');
        domElements.transcriptionDisplay = document.getElementById('transcription');
        domElements.classroomCodeDisplay = document.getElementById('classroom-code-display');
        domElements.studentUrlDisplay = document.getElementById('studentUrl');
        domElements.qrCodeContainer = document.getElementById('qr-code');
        domElements.studentCountDisplay = document.getElementById('studentCount');
        domElements.studentsListDisplay = document.getElementById('studentsList');

        if (domElements.languageSelect) {
            appState.selectedLanguage = domElements.languageSelect.value;
            domElements.languageSelect.addEventListener('change', handleLanguageChange);
        }
        
        if (domElements.classroomInfo) {
            domElements.classroomInfo.style.display = 'block';
        }
        
        if (domElements.recordButton) {
            domElements.recordButton.addEventListener('click', () => speechHandler.toggle()); // Call speechHandler.toggle
        }
        
        webSocketHandler.connect();
        speechHandler.setup(); // Call speechHandler.setup
    });

    function handleLanguageChange() {
        appState.selectedLanguage = this.value;
        webSocketHandler.register();
        if (appState.recognition) {
            appState.recognition.lang = this.value;
            // If currently recording, might need to stop and restart recognition with new lang
            if (appState.isRecording) {
                speechHandler.stop();
                // Consider a small delay or a way to ensure stop completes before starting
                // For simplicity now, just call start. User might need to click again if issues.
                speechHandler.start(); 
            }
        }
    }

})();