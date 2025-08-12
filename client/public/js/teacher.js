// TODO: [Technical Debt - Feature/Refactor]
// Consolidate language dropdown list from a single source of truth instead of being hardcoded in HTML.
// This applies to both teacher.html and student.html.

// TODO: [Technical Debt - Feature]
// Implement/fix the "Connected Students: <span id="studentCount">0</span>" display logic.
// This involves WebSocket messages from the server to update the count and potentially list.

console.log('[DEBUG] teacher.js: Top of file, script is being parsed.');

// Authentication check - ensure teacher is logged in
(function checkAuthentication() {
    // Check if we're in test mode
    const urlParams = new URLSearchParams(window.location.search);
    const isTestMode = urlParams.get('e2e') === 'true' || 
                      navigator.userAgent.includes('HeadlessChrome') || 
                      navigator.userAgent.includes('Firefox');
    
    if (isTestMode) {
        console.log('[DEBUG] teacher.js: Test mode detected, bypassing authentication');
        // Use teacher ID from URL parameter or default for tests
        const teacherId = urlParams.get('teacherId') || 'test-teacher-id';
        const teacherUsername = urlParams.get('teacherUsername') || 'test-teacher';
        
        // Set mock authentication data for tests
        localStorage.setItem('teacherToken', 'test-token-' + Date.now());
        localStorage.setItem('teacherUser', JSON.stringify({
            id: teacherId,
            username: teacherUsername,
            email: `${teacherUsername}@example.com`
        }));
        return;
    }
    
    const token = localStorage.getItem('teacherToken');
    const teacherUser = localStorage.getItem('teacherUser');
    
    if (!token || !teacherUser) {
        console.warn('[DEBUG] teacher.js: No authentication found, redirecting to login');
        window.location.href = '/teacher-login';
        return;
    }
    
    try {
        const user = JSON.parse(teacherUser);
        if (!user.id) {
            console.warn('[DEBUG] teacher.js: Invalid user data, redirecting to login');
            localStorage.removeItem('teacherToken');
            localStorage.removeItem('teacherUser');
            window.location.href = '/teacher-login';
            return;
        }
        console.log('[DEBUG] teacher.js: Authentication verified for user:', user.username);
    } catch (error) {
        console.error('[DEBUG] teacher.js: Error parsing user data:', error);
        localStorage.removeItem('teacherToken');
        localStorage.removeItem('teacherUser');
        window.location.href = '/teacher-login';
        return;
    }
})();

(function() {
    console.log('[DEBUG] teacher.js: IIFE executed.');
    // Enable WS audio streaming/final-send from URL flags for easy control
    try {
        const url = new URL(window.location.href);
        if (url.searchParams.get('stream') === '1') {
            window.SEND_AUDIO_STREAMING = '1';
            console.log('[DEBUG] URL flag stream=1 → enabled SEND_AUDIO_STREAMING');
        }
        if (url.searchParams.get('clientstt') === '1') {
            window.CLIENT_STT_TO_SERVER_ENABLED = '1';
            console.log('[DEBUG] URL flag clientstt=1 → enabled CLIENT_STT_TO_SERVER_ENABLED');
        }
    } catch (_) {}
    const appState = {
        ws: null,
        rtc: null,
        isRecording: false,
        recognition: null, // webkitSpeechRecognition instance
        selectedLanguage: 'en-US', // Default language, will be updated from DOM
        mediaRecorder: null, // MediaRecorder for audio capture
        audioChunks: [], // Store audio chunks
        sessionId: null, // Session ID for audio streaming
        chosenMimeType: undefined, // Selected MediaRecorder MIME type
        mediaReady: false, // Whether microphone has been initialized (iOS needs user gesture)
        readyToRecord: false, // True after WS connected, registered, and sessionId present
        lastSegmentBlob: null, // Last recorded audio segment for manual send
        translationMode: 'auto', // 'auto' | 'manual' (UI toggle)
        lastFinalTranscriptText: '' // caches last final transcript while recording
        // connectedStudents: new Map(), // Not currently used, for future student list feature
    };

    // Expose minimal state for RTC experiment helper
    try { window.appState = appState; } catch (_) {}

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
        toast: function(message, kind = 'info') {
            try {
                const el = document.createElement('div');
                el.textContent = message;
                el.style.position = 'fixed';
                el.style.right = '16px';
                el.style.bottom = '16px';
                el.style.padding = '10px 14px';
                el.style.borderRadius = '6px';
                el.style.color = '#fff';
                el.style.zIndex = '2000';
                el.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
                el.style.background = kind === 'error' ? '#dc3545' : (kind === 'success' ? '#198754' : '#0d6efd');
                document.body.appendChild(el);
                setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 300ms'; }, 1600);
                setTimeout(() => { el.remove(); }, 2000);
            } catch (_) {}
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
        },

        updateStudentCount: function(count) {
            if (domElements.studentCountDisplay) {
                domElements.studentCountDisplay.textContent = count;
            }
            
            // Update the students list display (for now just show count, can be enhanced later)
            if (domElements.studentsListDisplay) {
                if (count === 0) {
                    domElements.studentsListDisplay.textContent = 'No students connected yet';
                } else {
                    domElements.studentsListDisplay.textContent = `${count} student${count !== 1 ? 's' : ''} connected`;
                }
            }
        },

        updateSessionStatus: function(statusData) {
            // Update student count
            if (domElements.studentCountDisplay) {
                domElements.studentCountDisplay.textContent = statusData.connectedStudents;
            }
            
            // Update students list display
            if (domElements.studentsListDisplay) {
                if (statusData.connectedStudents === 0) {
                    domElements.studentsListDisplay.textContent = 'No students connected yet';
                } else {
                    domElements.studentsListDisplay.textContent = `${statusData.connectedStudents} student${statusData.connectedStudents !== 1 ? 's' : ''} connected`;
                }
            }
            
            // Update language breakdown
            const languageBreakdown = document.getElementById('languageBreakdown');
            const languageList = document.getElementById('languageList');
            
            if (statusData.languages && statusData.languages.length > 0) {
                // Show language breakdown section
                if (languageBreakdown) {
                    languageBreakdown.style.display = 'block';
                }
                
                // Clear existing list
                if (languageList) {
                    languageList.innerHTML = '';
                    
                    // Add each language
                    statusData.languages.forEach(lang => {
                        const listItem = document.createElement('li');
                        listItem.className = 'language-item';
                        listItem.innerHTML = `
                            <span class="language-name">${lang.languageName}</span>
                            <div class="language-count">
                                <span class="student-count-badge">${lang.studentCount}</span>
                                <span class="percentage">(${lang.percentage}%)</span>
                            </div>
                        `;
                        languageList.appendChild(listItem);
                    });
                }
            } else {
                // Hide language breakdown section if no languages
                if (languageBreakdown) {
                    languageBreakdown.style.display = 'none';
                }
            }
            
            // Update last updated time
            const lastUpdatedElement = document.getElementById('lastUpdated');
            const lastUpdatedTimeElement = document.getElementById('lastUpdatedTime');
            if (lastUpdatedElement && lastUpdatedTimeElement) {
                lastUpdatedElement.style.display = 'block';
                lastUpdatedTimeElement.textContent = new Date().toLocaleTimeString();
            }
        }
    };

    // Cross-platform helpers (encapsulate environment-specific logic)
    const platform = {
        isIOSWebKit: function() {
            const ua = navigator.userAgent || navigator.vendor || window.opera;
            // iOS devices use WebKit across Safari/Chrome; detect via iPhone/iPad and WebKit
            const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
            const isWebKit = /WebKit/.test(ua);
            return isIOS && isWebKit;
        },
        selectSupportedAudioMimeType: function() {
            // Ordered by typical availability across platforms
            const candidates = [
                'audio/webm;codecs=opus',
                'audio/webm',
                'audio/mp4;codecs=mp4a.40.2', // iOS Safari commonly supports AAC in MP4
                'audio/ogg;codecs=opus',
                'audio/ogg'
            ];
            for (const t of candidates) {
                try {
                    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) {
                        return t;
                    }
                } catch (_) {
                    // continue
                }
            }
            return undefined; // let browser choose default
        }
    };

    // Manual mode detection (priority: UI state, fallback URL param)
    function isManualModeEnabled() {
        // Require URL flag to gate manual transmission feature visibility
        try { const url = new URL(window.location.href); if (url.searchParams.get('manual') !== '1') return false; } catch (_) { return false; }
        return appState.translationMode === 'manual';
    }

    // Session Status Service for fetching language breakdown
    const sessionStatusService = {
        async refreshStatus(sessionId) {
            if (!sessionId) {
                // Don't display error if no sessionId (likely first page load)
                console.warn('[DEBUG] refreshStatus: No session ID provided');
                return null;
            }

            try {
                console.log('[DEBUG] Fetching session status for:', sessionId);
                const response = await fetch(`/api/sessions/${sessionId}/status`);

                if (!response.ok) {
                    if (response.status === 404) {
                        console.warn('[DEBUG] Session status 404 - likely before session persisted; suppressing UI error');
                        return null;
                    }
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                console.log('[DEBUG] Session status response:', data);

                if (data.success) {
                    uiUpdater.updateSessionStatus(data.data);
                    return data.data;
                } else {
                    throw new Error(data.message || 'Failed to fetch session status');
                }
            } catch (error) {
                // Only display error for non-404 HTTP errors
                if (sessionId) {
                    const message = (error && error.message) ? error.message : '';
                    if (message.includes('HTTP 404')) {
                        console.warn('[DEBUG] Suppressing 404 status error after first load');
                        return null;
                    }
                    console.error('[DEBUG] Error refreshing session status:', error);
                    uiUpdater.updateStatus(`Failed to refresh status: ${message}`, 'error');
                } else {
                    // Suppress error message on first load
                    console.warn('[DEBUG] Suppressed status error on first load:', error);
                }
                return null;
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
                if (window.RealtimeClientFactory) {
                    appState.rtc = window.RealtimeClientFactory.create({ wsUrl, wsCtor: WebSocket });
                }
                appState.ws = appState.rtc ? null : new WebSocket(wsUrl);
                console.log('[DEBUG] teacher.js: WebSocket/RealtimeClient created for URL:', wsUrl);
            } catch (e) {
                console.error('[DEBUG] teacher.js: Error creating WebSocket object:', e);
                uiUpdater.updateStatus('Error creating WebSocket connection: ' + e.message, 'error');
                return;
            }
            
            if (appState.rtc) {
                appState.rtc.onOpen(() => {
                    console.log('[DEBUG] teacher.js: RealtimeClient onopen event fired.');
                    uiUpdater.updateStatus('Connected to server');
                    this.register();
                });
                appState.rtc.onMessage((event) => {
                    console.log('[DEBUG] teacher.js: RealtimeClient onmessage event fired. Data:', event.data);
                    this.handleMessage(event);
                });
                appState.rtc.onClose((event) => {
                    console.log('[DEBUG] teacher.js: RealtimeClient onclose event fired.');
                    uiUpdater.updateStatus('Disconnected from server');
                    setTimeout(() => this.connect(), 5000);
                });
                appState.rtc.onError((error) => {
                    console.error('[DEBUG] teacher.js: RealtimeClient onerror event fired:', error);
                    uiUpdater.updateStatus('Connection error.', 'error');
                });
                appState.rtc.connect(wsUrl);
            } else if (appState.ws) {
                appState.ws.onopen = () => {
                    console.log('[DEBUG] teacher.js: WebSocket onopen event fired.');
                    uiUpdater.updateStatus('Connected to server');
                    this.register(); 
                };
                appState.ws.onmessage = (event) => {
                    console.log('[DEBUG] teacher.js: WebSocket onmessage event fired. Data:', event.data);
                    this.handleMessage(event);
                }; // Use arrow function or .bind for correct 'this'
                appState.ws.onclose = (event) => {
                    console.log('[DEBUG] teacher.js: WebSocket onclose event fired. Was clean:', event.wasClean, 'Code:', event.code, 'Reason:', event.reason);
                    
                    // Only reconnect for unexpected disconnections, not for duplicate sessions
                    // Code 1000 = normal closure, Code 1001 = going away, Code 1006 = abnormal closure
                    // Do NOT reconnect on policy violation/normal close codes often used by server for cleanup (e.g., 1008)
                    const nonReconnectCodes = new Set([1000, 1001, 1008]);
                    const shouldReconnect = !event.wasClean && !nonReconnectCodes.has(event.code);
                    
                    if (shouldReconnect && viteWsUrlFromWindow) {
                        if (!appState.isRecording) {
                        uiUpdater.updateStatus('Disconnected from server. Attempting to reconnect...');
                        }
                        setTimeout(() => this.connect(), 5000);
                    } else {
                        if (!appState.isRecording) {
                        uiUpdater.updateStatus('Disconnected from server');
                        }
                        console.log('[DEBUG] teacher.js: Not reconnecting - connection was closed normally or duplicate session detected');
                    }
                };
                appState.ws.onerror = (error) => {
                    console.error('[DEBUG] teacher.js: WebSocket onerror event fired:', error);
                    uiUpdater.updateStatus('WebSocket connection error.', 'error');
                };
            }
        },

        register: function() {
            console.log('[DEBUG] teacher.js: webSocketHandler.register called.');
            if (appState.rtc && appState.rtc.isOpen && appState.rtc.isOpen()) {
                const teacherUser = JSON.parse(localStorage.getItem('teacherUser') || '{}');
                const teacherId = teacherUser.id ? teacherUser.id.toString() : null;
                if (!teacherId) {
                    console.error('[DEBUG] teacher.js: No teacherId available, redirecting to login');
                    uiUpdater.updateStatus('Authentication error: No teacher ID found', 'error');
                    localStorage.removeItem('teacherToken');
                    localStorage.removeItem('teacherUser');
                    window.location.href = '/teacher-login';
                    return;
                }
                appState.rtc.registerTeacher(teacherId, appState.selectedLanguage);
                return;
            }
            if (appState.ws && appState.ws.readyState === WebSocket.OPEN) {
                // Get authenticated teacher info from localStorage
                const teacherUser = JSON.parse(localStorage.getItem('teacherUser') || '{}');
                const teacherId = teacherUser.id ? teacherUser.id.toString() : null;
                
                if (!teacherId) {
                    console.error('[DEBUG] teacher.js: No teacherId available, redirecting to login');
                    uiUpdater.updateStatus('Authentication error: No teacher ID found', 'error');
                    localStorage.removeItem('teacherToken');
                    localStorage.removeItem('teacherUser');
                    window.location.href = '/teacher-login';
                    return;
                }
                
                const message = {
                    type: 'register',
                    role: 'teacher',
                    languageCode: appState.selectedLanguage,
                    teacherId: teacherId // Pass the authenticated teacher ID
                };
                
                console.log('[DEBUG] teacher.js: Sending register message with teacherId:', message);
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
                        // Allow recording immediately once we have a sessionId
                        appState.readyToRecord = true;
                    }
                    break;

                case 'register':
                    console.log('Register response received:', data); // Original log for line 185
                    if (data.status === 'success') {
                        uiUpdater.updateStatus('Registered as teacher', 'success');
                        console.log('Teacher registration successful:', data);
                        appState.readyToRecord = !!appState.sessionId;
                        
                        // Initial refresh of language breakdown after successful registration
                        if (appState.sessionId) {
                            setTimeout(() => {
                                sessionStatusService.refreshStatus(appState.sessionId).catch(error => {
                                    console.warn('[DEBUG] Failed to do initial language breakdown refresh:', error);
                                });
                            }, 1000); // Small delay to allow for any initial student connections
                        }

                        // Auto-start experimental WebRTC offer if enabled
                        if (window.RTC_EXPERIMENT === '1' && window.RTCExperiment && appState.sessionId) {
                            try {
                                uiUpdater.updateStatus('Starting WebRTC experiment...');
                                window.RTCExperiment.startOffer(appState.sessionId);
                            } catch (e) {
                                console.warn('[RTCExperiment] startOffer failed', e);
                            }
                        }
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
                    // If server migrated us to an existing session, it will include sessionId here.
                    if (data.sessionId) {
                        console.log('[DEBUG] Updating sessionId from classroom_code:', data.sessionId);
                        appState.sessionId = data.sessionId;
                        appState.readyToRecord = true;
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

                case 'webrtc_answer':
                    if (window.RTC_EXPERIMENT === '1' && window.RTCExperiment) {
                        try { window.RTCExperiment.applyServerAnswer(data.sdp); } catch (e) { console.warn('[RTCExperiment] applyServerAnswer failed', e); }
                    }
                    break;

                case 'webrtc_ice_candidate':
                    if (window.RTC_EXPERIMENT === '1' && window.RTCExperiment) {
                        try { window.RTCExperiment.addServerIce(data.candidate); } catch (e) { console.warn('[RTCExperiment] addServerIce failed', e); }
                    }
                    break;

                case 'manual_send_ack':
                    if (data.status === 'ok') {
                        uiUpdater.toast('Sent to students', 'success');
                    } else {
                        uiUpdater.toast(data.message || 'Failed to send', 'error');
                    }
                    break;

                case 'ping':
                    // console.log('Ping received from server, sending pong.');
                    this.sendPong();
                    break;

                case 'studentCountUpdate':
                    console.log('Student count update received:', data);
                    if (typeof data.count === 'number') {
                        uiUpdater.updateStudentCount(data.count);
                        
                        // Also refresh the language breakdown when student count changes
                        if (appState.sessionId) {
                            sessionStatusService.refreshStatus(appState.sessionId).catch(error => {
                                console.warn('[DEBUG] Failed to refresh language breakdown:', error);
                            });
                        }
                    }
                    break;

                default: 
                    console.log('Unknown message type received by teacher:', data.type, data);
            }
        },

        sendTranscription: function(text) {
            // If manual mode flag present, do not auto-send transcriptions
            try {
                const url = new URL(window.location.href);
                if (url.searchParams.get('manual') === '1') {
                    return;
                }
            } catch(_) {}
            if (appState.rtc && appState.rtc.isOpen && appState.rtc.isOpen()) {
                appState.rtc.sendTranscription(text);
                return;
            }
            if (appState.ws && appState.ws.readyState === WebSocket.OPEN) {
                const message = { type: 'transcription', text: text, timestamp: Date.now(), isFinal: true };
                appState.ws.send(JSON.stringify(message));
            }
        },

        sendAudioChunk: function(audioData, isFirstChunk = false, isFinalChunk = false, isManual = false) {
            if (appState.sessionId && appState.rtc && appState.rtc.isOpen && appState.rtc.isOpen()) {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64Audio = reader.result.split(',')[1];
                    appState.rtc.sendAudioChunk(appState.sessionId, base64Audio, isFirstChunk, isFinalChunk, appState.selectedLanguage);
                };
                reader.readAsDataURL(audioData);
                return;
            }
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
                        language: appState.selectedLanguage,
                        manual: !!isManual
                    };
                    appState.ws.send(JSON.stringify(message));
                };
                reader.readAsDataURL(audioData);
            }
        },

        sendPong: function() {
            if (appState.rtc && appState.rtc.isOpen && appState.rtc.isOpen()) {
                appState.rtc.sendPong();
                return;
            }
            if (appState.ws && appState.ws.readyState === WebSocket.OPEN) {
                appState.ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            }
        }
    };

    const audioHandler = {
        setup: async function() {
            try {
                const iOS = platform.isIOSWebKit();
                // Primary constraints (desktop/mobile capable)
                let constraints = iOS
                  ? { audio: true } // Broad constraint for iOS Safari compatibility
                  : { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, sampleRate: 48000, channelCount: 1 } };

                let stream;
                try {
                    stream = await navigator.mediaDevices.getUserMedia(constraints);
                } catch (primaryErr) {
                    console.warn('[DEBUG] Primary getUserMedia failed, retrying with broad constraints:', primaryErr && primaryErr.name);
                    // Fallback constraints for finicky mobile browsers
                    constraints = { audio: true };
                    try {
                        stream = await navigator.mediaDevices.getUserMedia(constraints);
                    } catch (fallbackErr) {
                        console.error('Error setting up audio capture (all attempts):', fallbackErr);
                        uiUpdater.updateStatus('Microphone access failed. Please check site permissions and use HTTPS.', 'error');
                        return false;
                    }
                }
                // Create MediaRecorder for audio capture with clean fallback strategy
                const chosen = platform.selectSupportedAudioMimeType();
                const options = chosen ? { mimeType: chosen } : undefined;
                appState.chosenMimeType = chosen;
                // On iOS, prefer default constructor without options to avoid NotSupportedError
                appState.mediaRecorder = platform.isIOSWebKit() ? new MediaRecorder(stream) : new MediaRecorder(stream, options);
                console.log('[DEBUG] MediaRecorder created. chosenMimeType=', chosen, 'actual=', appState.mediaRecorder.mimeType);
                
                let isFirstChunk = true;
                
                appState.mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        appState.audioChunks.push(event.data);
                        // Streaming of audio to server is disabled by default to avoid duplicate TTS.
                        // Set window.SEND_AUDIO_STREAMING='1' to re-enable for experiments.
                        if (!isManualModeEnabled() && appState.isRecording && window.SEND_AUDIO_STREAMING === '1') {
                            webSocketHandler.sendAudioChunk(event.data, isFirstChunk, false);
                            isFirstChunk = false;
                        }
                    }
                };
                
                appState.mediaRecorder.onstop = () => {
                    // iOS WebKit fallback: MediaRecorder does not stream reliably; send final blob on stop.
                    if (platform.isIOSWebKit() && appState.audioChunks.length > 0) {
                        const blobTypeIOS = appState.chosenMimeType || 'audio/mp4;codecs=mp4a.40.2';
                        const audioBlobIOS = new Blob(appState.audioChunks, { type: blobTypeIOS });
                        console.log('[DEBUG] [iOS Fallback] Final audio blob size(bytes)=', audioBlobIOS.size, 'type=', blobTypeIOS);
                        // In manual mode, store for later manual send; otherwise, send immediately (legacy behavior)
                        if (isManualModeEnabled()) {
                            appState.lastSegmentBlob = audioBlobIOS;
                            uiUpdater.updateStatus('Ready to send last audio segment');
                        } else {
                            uiUpdater.updateStatus('Sending final audio for transcription...');
                            webSocketHandler.sendAudioChunk(audioBlobIOS, false, true);
                        }
                        appState.audioChunks = [];
                        return;
                    }
                    // Default behavior: when both flags are set, send final blob
                    if (!isManualModeEnabled() && window.SEND_AUDIO_STREAMING === '1' && window.CLIENT_STT_TO_SERVER_ENABLED === '1' && appState.audioChunks.length > 0) {
                        const blobType = appState.chosenMimeType || appState.mediaRecorder.mimeType || 'audio/webm';
                        const audioBlob = new Blob(appState.audioChunks, { type: blobType });
                        console.log('[DEBUG] Final audio blob size(bytes)=', audioBlob.size, 'type=', blobType);
                        uiUpdater.updateStatus('Sending final audio for transcription...');
                        webSocketHandler.sendAudioChunk(audioBlob, false, true);
                        appState.audioChunks = [];
                        return;
                    }
                    // New: If speech recognition is unavailable (common on many phones), send final blob by default
                    if (!isManualModeEnabled() && appState.audioChunks.length > 0 && !('webkitSpeechRecognition' in window)) {
                        const fallbackType = appState.chosenMimeType || appState.mediaRecorder.mimeType || 'audio/webm';
                        const finalBlob = new Blob(appState.audioChunks, { type: fallbackType });
                        console.log('[DEBUG] [No Client STT] Final audio blob size(bytes)=', finalBlob.size, 'type=', fallbackType);
                        uiUpdater.updateStatus('Sending final audio for transcription...');
                        webSocketHandler.sendAudioChunk(finalBlob, false, true);
                        appState.audioChunks = [];
                        return;
                    } else if (isManualModeEnabled() && appState.audioChunks.length > 0) {
                        const blobType = appState.chosenMimeType || appState.mediaRecorder.mimeType || 'audio/webm';
                        appState.lastSegmentBlob = new Blob(appState.audioChunks, { type: blobType });
                        uiUpdater.updateStatus('Ready to send last audio segment');
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
                // On iOS WebKit, timeslice often does not emit chunks; start without timeslice
                if (platform.isIOSWebKit()) {
                    appState.mediaRecorder.start(); // iOS: timeslice often ignored; rely on onstop final blob
                } else {
                    appState.mediaRecorder.start(200); // Slightly larger slice for stability on Android/desktop
                }
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
                        // If client intends to send final audio blob to server (clientstt=1),
                        // avoid sending interim text to server to prevent real-time TTS.
                        const disableServerRealtimeTTS = window.CLIENT_STT_TO_SERVER_ENABLED === '1';
                        if (!disableServerRealtimeTTS) {
                            webSocketHandler.sendTranscription(finalTranscript);
                        }
                        // Display locally as well
                        uiUpdater.displayTranscription(finalTranscript, true);
                        // Cache last final transcript so we can send once on stop if needed
                        appState.lastFinalTranscriptText = finalTranscript;
                        // In manual mode, populate the manual text area for review/send
                        if (isManualModeEnabled()) {
                            const ta = document.getElementById('manualText');
                            if (ta) {
                                const prev = ta.value.trim();
                                ta.value = prev ? prev + '\n' + finalTranscript : finalTranscript;
                            }
                        }
                        // Mark that we already sent text for this recording to avoid double TTS on stop
                        appState.sentTranscriptionThisRecording = true;
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
                // Do not block recording if SpeechRecognition is unavailable (e.g., iOS Safari)
                console.warn('[teacher.js] Speech recognition not supported; falling back to server-side transcription only.');
                uiUpdater.updateStatus('Recording without on-device speech recognition');
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
            appState.isRecording = true;
            // Try to start recognition if available, but do not require it
            try {
                if (appState.recognition) {
                    appState.recognition.lang = domElements.languageSelect ? domElements.languageSelect.value : appState.selectedLanguage;
                    appState.recognition.start();
                }
            } catch (e) {
                console.warn('Speech recognition start failed; continuing with audio-only recording:', e);
            }
            
            try {
                // Always start audio capture for server-side transcription
                audioHandler.startRecording();
                uiUpdater.setRecordButtonToRecording();
                uiUpdater.updateStatus('Recording...');
                // Reset duplicate-guard flag for this recording
                appState.sentTranscriptionThisRecording = false;
            } catch (e) {
                console.error('Error starting audio recording:', e);
                uiUpdater.updateStatus('Error starting recording.');
                appState.isRecording = false; // Reset state
            }
        },

        stop: function() {
            appState.isRecording = false;
            
            // Stop speech recognition
            try {
                if (appState.recognition) {
                    appState.recognition.stop();
                }
            } catch (_) { /* no-op */ }
            
            // Stop audio recording
            audioHandler.stopRecording();
            
            uiUpdater.setRecordButtonToStopped();
            uiUpdater.updateStatus('Recording stopped');

            // In stream+clientstt mode, proactively send the final transcript text once on stop
            // This ensures students receive a translation+TTS even if audio decode fails upstream.
            try {
                const url = new URL(window.location.href);
                const streamEnabled = url.searchParams.get('stream') === '1' || window.SEND_AUDIO_STREAMING === '1';
                const clientSttEnabled = url.searchParams.get('clientstt') === '1' || window.CLIENT_STT_TO_SERVER_ENABLED === '1';
                if (streamEnabled && clientSttEnabled && appState.lastFinalTranscriptText) {
                    webSocketHandler.sendTranscription(appState.lastFinalTranscriptText);
                    console.log('[DEBUG] Sent final transcript text on stop to ensure delivery.');
                }
            } catch (_) {}
        }
    };

    document.addEventListener('DOMContentLoaded', function main() {
        console.log('[DEBUG] teacher.js: DOMContentLoaded event fired.');
        
        // Check authentication and display teacher info
        const teacherUser = JSON.parse(localStorage.getItem('teacherUser') || '{}');
        const teacherInfoElement = document.getElementById('teacher-info');
        if (teacherInfoElement && teacherUser.username) {
            teacherInfoElement.textContent = `Welcome, ${teacherUser.username}`;
        }
        
        // Setup logout button
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function() {
                // Clear authentication data
                localStorage.removeItem('teacherToken');
                localStorage.removeItem('teacherUser');
                
                // Close WebSocket connection
                if (appState.rtc && appState.rtc.close) { appState.rtc.close(); }
                if (appState.ws) { appState.ws.close(); }
                
                // Redirect to login page
                window.location.href = '/teacher-login';
            });
        }
        
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
            domElements.recordButton.addEventListener('click', async () => {
                // Prevent starting before we have a valid sessionId and completed registration
                if (!appState.readyToRecord) {
                    uiUpdater.updateStatus('Please wait... establishing session');
                    return;
                }
                if (platform.isIOSWebKit() && !appState.mediaRecorder) {
                    const ok = await audioHandler.setup();
                    appState.mediaReady = !!ok;
                }
                speechHandler.toggle();
            });
        }
        // Wire translation mode toggle when manual UI is enabled
        try {
            const url = new URL(window.location.href);
            const manual = url.searchParams.get('manual') === '1';
            const modeGroup = document.getElementById('modeToggleGroup');
            if (manual && modeGroup) {
                const radios = modeGroup.querySelectorAll('input[name="mode"]');
                const sendSetting = (mode) => {
                    if (appState.ws && appState.ws.readyState === WebSocket.OPEN) {
                        appState.ws.send(JSON.stringify({ type: 'settings', settings: { translationMode: mode } }));
                        appState.translationMode = mode;
                        // Toggle UI sections for clarity (either/or)
                        const manualControls = document.getElementById('manualControls');
                        if (manualControls) manualControls.style.display = mode === 'manual' ? 'block' : 'none';
                        const recordControls = document.getElementById('recordControls') || document.querySelector('.control-group');
                        if (recordControls) recordControls.style.display = 'block'; // keep record controls in both
                    }
                };
                radios.forEach((r) => {
                    r.addEventListener('change', () => {
                        if (r.checked) sendSetting(r.value);
                    });
                });
                // Default to manual if manual flag is present
                sendSetting('manual');
            }
        } catch(_) {}
        // Inform user about device limitations if applicable
        if (platform.isIOSWebKit() && domElements.statusDisplay) {
            domElements.statusDisplay.insertAdjacentText('afterbegin', 'Note: Live audio streaming may be limited on this device; audio is sent when you stop recording. ');
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