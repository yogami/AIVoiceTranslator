(function() {
    let ws = null;
    let isRecording = false;
    let mediaRecorder = null;
    let recognition = null;
    let sessionId = null;
    let connectedStudents = new Map();
    let selectedLanguage = 'en-US'; // Default language

    document.addEventListener('DOMContentLoaded', function main() {
        const languageSelect = document.getElementById('teacherLanguage');
        selectedLanguage = languageSelect.value;
        
        document.getElementById('classroomInfo').style.display = 'block';
        
        const recordButton = document.getElementById('recordButton');
        if (recordButton) {
            recordButton.addEventListener('click', toggleRecording);
        }
        
        connectWebSocket();
        setupSpeechRecognition();
    });

    function connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        updateStatus('Connecting to server...');
        
        ws = new WebSocket(wsUrl);
        
        ws.onopen = function() {
            updateStatus('Connected to server');
        };
        
        ws.onmessage = handleMessage;
        
        ws.onclose = function() {
            updateStatus('Disconnected from server');
            document.getElementById('classroom-code-display').textContent = 'DISCONNECTED';
            setTimeout(connectWebSocket, 3000);
        };
        
        ws.onerror = function(error) {
            updateStatus('Connection error');
            console.error('WebSocket error:', error);
        };
    }

    function registerAsTeacher() {
        if (ws && ws.readyState === WebSocket.OPEN) {
            const message = {
                type: 'register',
                role: 'teacher',
                languageCode: selectedLanguage
            };
            
            ws.send(JSON.stringify(message));
        }
    }

    function handleMessage(event) {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
            case 'connection':
                updateStatus('Connected to server');
                registerAsTeacher();
                break;
                
            case 'register':
                if (data.status === 'success') {
                    updateStatus('Registered as teacher');
                }
                break;
                
            case 'classroom_code':
                displayClassroomCode(data.code, data.expiresAt);
                break;
                
            case 'transcription':
                displayTranscription(data.text, data.isFinal);
                break;
                
            case 'error':
                console.error('Server error:', data.message);
                updateStatus(`Error: ${data.message}`, 'error');
                break;
                
            case 'ping':
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
                }
                break;
                
            default:
                console.log('Unknown message type:', data.type);
        }
    }

    function displayClassroomCode(code, expiresAt) {
        const classroomDisplay = document.getElementById('classroom-code-display');
        if (classroomDisplay) {
            classroomDisplay.textContent = code;
        }
        
        const studentUrl = `${window.location.origin}/student?code=${code}`;
        const studentUrlEl = document.getElementById('studentUrl');
        if (studentUrlEl) {
            studentUrlEl.textContent = studentUrl;
        }
        
        const qrContainer = document.getElementById('qr-code');
        if (qrContainer && typeof QRCode !== 'undefined') {
            qrContainer.innerHTML = '';
            qrContainer.style.display = 'block';
            new QRCode(qrContainer, {
                text: studentUrl,
                width: 150,
                height: 150
            });
        }
        
        if (expiresAt) {
            const expirationDate = new Date(expiresAt);
            console.log(`Classroom code ${code} expires at ${expirationDate.toLocaleTimeString()}`);
        }
    }
    
    function setupSpeechRecognition() {
        if ('webkitSpeechRecognition' in window) {
            recognition = new webkitSpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = document.getElementById('teacherLanguage').value;
            
            recognition.onresult = function(event) {
                let finalTranscript = '';
                let interimTranscript = '';
                
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }
                
                if (finalTranscript) {
                    sendTranscription(finalTranscript);
                    addToTranscription(finalTranscript);
                }
            };
            
            recognition.onerror = function(event) {
                console.error('Speech recognition error:', event.error);
                updateStatus('Speech recognition error: ' + event.error);
            };
            
            recognition.onend = function() {
                if (isRecording) {
                    recognition.start();
                }
            };
        } else {
            updateStatus('Speech recognition not supported in this browser');
        }
    }

    function toggleRecording() {
        if (!isRecording) {
            startRecording();
        } else {
            stopRecording();
        }
    }

    function startRecording() {
        if (!recognition) {
            updateStatus('Speech recognition not available');
            return;
        }
        
        isRecording = true;
        recognition.lang = document.getElementById('teacherLanguage').value;
        recognition.start();
        
        const button = document.getElementById('recordButton');
        button.textContent = 'Stop Recording';
        button.classList.add('recording');
        
        updateStatus('Recording... Speak naturally');
    }

    function stopRecording() {
        isRecording = false;
        
        if (recognition) {
            recognition.stop();
        }
        
        const button = document.getElementById('recordButton');
        button.textContent = 'Start Recording';
        button.classList.remove('recording');
        
        updateStatus('Recording stopped');
    }

    function sendTranscription(text) {
        if (ws && ws.readyState === WebSocket.OPEN) {
            const message = {
                type: 'transcription',
                text: text,
                timestamp: Date.now(),
                isFinal: true
            };
            ws.send(JSON.stringify(message));
        }
    }

    function addToTranscription(text) {
        const transcriptionEl = document.getElementById('transcription');
        const timestamp = new Date().toLocaleTimeString();
        transcriptionEl.textContent += `[${timestamp}] ${text}\n`;
        transcriptionEl.scrollTop = transcriptionEl.scrollHeight;
    }

    function updateStatus(message, type) {
        const statusEl = document.getElementById('status');
        statusEl.textContent = message;
    }

    document.getElementById('teacherLanguage').addEventListener('change', function() {
        selectedLanguage = this.value;
        if (ws && ws.readyState === WebSocket.OPEN) {
            registerAsTeacher();
        }
        
        if (recognition) {
            recognition.lang = this.value;
        }
    });
})(); 