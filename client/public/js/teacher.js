(function() {
    const appState = {
        ws: null,
        isRecording: false,
        recognition: null, // webkitSpeechRecognition instance
        selectedLanguage: 'en-US', // Default language, will be updated from DOM
        // mediaRecorder: null, // Not currently used, can be added if needed
        // sessionId: null, // Not currently used, can be added if needed
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
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws`;
            uiUpdater.updateStatus('Connecting to server...');
            appState.ws = new WebSocket(wsUrl);
            
            appState.ws.onopen = () => {
                uiUpdater.updateStatus('Connected to server');
                // Registration is now typically triggered by server's 'connection' message
            };
            appState.ws.onmessage = (event) => this.handleMessage(event); // Use arrow function or .bind for correct 'this'
            appState.ws.onclose = () => {
                uiUpdater.updateStatus('Disconnected from server');
                if (domElements.classroomCodeDisplay) domElements.classroomCodeDisplay.textContent = 'DISCONNECTED';
                setTimeout(() => this.connect(), 3000); // Reconnect via the handler method
            };
            appState.ws.onerror = (error) => {
                uiUpdater.updateStatus('Connection error');
                console.error('WebSocket error:', error);
            };
        },

        register: function() {
            if (appState.ws && appState.ws.readyState === WebSocket.OPEN) {
                const message = {
                    type: 'register',
                    role: 'teacher',
                    languageCode: appState.selectedLanguage
                };
                appState.ws.send(JSON.stringify(message));
            }
        },

        handleMessage: function(event) {
            const data = JSON.parse(event.data);
            switch (data.type) {
                case 'connection':
                    uiUpdater.updateStatus('Connected to server');
                    this.register(); // Call internal method
                    break;
                case 'register':
                    if (data.status === 'success') uiUpdater.updateStatus('Registered as teacher');
                    break;
                case 'classroom_code':
                    uiUpdater.displayClassroomCode(data.code, data.expiresAt);
                    break;
                case 'transcription': 
                    uiUpdater.displayTranscription(data.text, data.isFinal);
                    break; 
                case 'error':
                    console.error('Server error:', data.message);
                    uiUpdater.updateStatus(`Error: ${data.message}`, 'error');
                    break;
                case 'ping':
                    this.sendPong();
                    break;
                default: console.log('Unknown message type:', data.type);
            }
        },

        sendTranscription: function(text) {
            if (appState.ws && appState.ws.readyState === WebSocket.OPEN) {
                const message = { type: 'transcription', text: text, timestamp: Date.now(), isFinal: true };
                appState.ws.send(JSON.stringify(message));
            }
        },

        sendPong: function() {
            if (appState.ws && appState.ws.readyState === WebSocket.OPEN) {
                appState.ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
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
                        webSocketHandler.sendTranscription(finalTranscript);
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

        toggle: function() {
            if (!appState.isRecording) this.start();
            else this.stop();
        },

        start: function() {
            if (!appState.recognition) {
                uiUpdater.updateStatus('Speech recognition not available');
                return;
            }
            appState.isRecording = true;
            appState.recognition.lang = domElements.languageSelect ? domElements.languageSelect.value : appState.selectedLanguage;
            try {
                appState.recognition.start();
                uiUpdater.setRecordButtonToRecording();
                uiUpdater.updateStatus('Recording... Speak naturally');
            } catch (e) {
                console.error("Error starting speech recognition:", e);
                uiUpdater.updateStatus('Error starting recording.');
                appState.isRecording = false; // Reset state
            }
        },

        stop: function() {
            appState.isRecording = false;
            if (appState.recognition) {
                appState.recognition.stop();
            }
            uiUpdater.setRecordButtonToStopped();
            uiUpdater.updateStatus('Recording stopped');
        }
    };

    document.addEventListener('DOMContentLoaded', function main() {
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
        
        webSocketHandler.connect(); // Initial connection
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