(function() { // Start of IIFE
    const __STUDENT_JS_VERSION__ = '20250810-8';
    console.log('[student.js] Version', __STUDENT_JS_VERSION__);
    const appState = {
        ws: null,
        selectedLanguage: null,
        currentAudioData: null,
        currentAudioBlobUrl: null,
        currentBrowserTTS: null, // Store browser TTS utterance for replay
        isConnected: false,
        classroomCode: null, // Will get this from URL params
        isClassroomCodeValid: null, // null=unknown, 'valid' | 'invalid' after validation
        hasEverConnected: false // keep status hidden until first successful connection
    };

    const domElements = {
        connectionStatus: null,
        translationDisplay: null,
        connectButton: null,
        proxyConnectButton: null,
        languageDropdown: null,
        selectedLanguageDisplay: null,
        playButton: null,
        playOriginalButton: null,
        volumeControl: null,
        lowLiteracyToggle: null,
        container: null, // For inserting classroomInfo
        h1Element: null, // For inserting classroomInfo
        languageStep: null,
        connectStep: null,
        translationStep: null,
        audioStep: null,
        askStep: null,
        askInput: null,
        askSend: null,
        askPTT: null
    };

    // UI helpers to ensure elements are actually hidden/shown in all builds
    function hideElement(el) {
        if (!el) return;
        try { el.classList.add('hidden'); } catch (_) {}
        try { el.style.display = 'none'; } catch (_) {}
    }
    function showElement(el, displayStyle) {
        if (!el) return;
        try { el.classList.remove('hidden'); } catch (_) {}
        try { el.style.display = displayStyle || ''; } catch (_) {}
    }

    const uiUpdater = {
        showNoClassroomCodeError: function() {
            if (domElements.connectionStatus) {
                domElements.connectionStatus.innerHTML = `
                    <div class="indicator disconnected"></div>
                    <span>No classroom code provided</span>
                `;
                showElement(domElements.connectionStatus);
            }
            if (domElements.translationDisplay) {
                domElements.translationDisplay.innerHTML = 
                    '<div style="color: red; text-align: center; padding: 20px;">' +
                    '<h3>❌ Missing Classroom Code</h3>' +
                    '<p>Please get the correct link from your teacher.</p>' +
                    '<p>The link should look like: <code>/student?code=ABC123</code></p>' +
                    '</div>';
            }
            showElement(domElements.translationStep);
            if (domElements.connectButton) domElements.connectButton.disabled = true;
        },

        showJoiningClassroomInfo: function(classroomCode) {
            // Classic UI: keep banner; UI V2: use compact badge in status row
            const isUi2 = document.body.classList.contains('ui-v2');
            if (isUi2) {
                const badge = document.getElementById('classroom-code-badge');
                if (badge) {
                    badge.textContent = `Classroom: ${classroomCode}`;
                    badge.style.display = 'inline-block';
                }
                return;
            }
            const classroomInfo = document.createElement('div');
            classroomInfo.style.cssText = 'text-align: center; margin-bottom: 20px; padding: 10px; background: #e8f5e8; border-radius: 6px; border: 2px solid #28a745;';
            classroomInfo.innerHTML = `
                <div style="font-weight: bold; color: #28a745;">Joining Classroom: ${classroomCode}</div>
            `;
            if (domElements.container && domElements.h1Element) {
                domElements.container.insertBefore(classroomInfo, domElements.h1Element.nextSibling);
            }
        },

        updateSelectedLanguageDisplay: function(languageName) {
            if (domElements.selectedLanguageDisplay) {
                domElements.selectedLanguageDisplay.textContent = languageName ? `Selected: ${languageName}` : '';
            }
            // Reveal connect step only after language chosen
            if (domElements.connectStep) {
                // Reveal connect if a language is chosen and the code is not confirmed invalid
                // Allow showing Connect even without a classroom code; server will validate on register
                if (languageName) {
                    // Only reveal connect when classroom code is present and not invalid
                    if (appState.classroomCode && appState.isClassroomCodeValid !== 'invalid') {
                        showElement(domElements.connectStep);
                    } else {
                        hideElement(domElements.connectStep);
                    }
                    showElement(domElements.connectionStatus, '');
                    domElements.connectButton && (domElements.connectButton.disabled = false);
                    domElements.proxyConnectButton && (domElements.proxyConnectButton.disabled = false);
                } else {
                    hideElement(domElements.connectStep);
                }
            }
            // Hide later steps until connected (status row shown only after language selection)
            if (!appState.isConnected) {
                hideElement(domElements.translationStep);
                hideElement(domElements.audioStep);
                // connection status gating handled based on language selection below
            }
        },

        updateConnectionStatus: function(connected) {
            if (!domElements.connectionStatus || !domElements.connectButton) return;
            const indicator = domElements.connectionStatus.querySelector('.indicator');
            const text = domElements.connectionStatus.querySelector('span');
            appState.isConnected = connected;
            if (connected) {
                appState.hasEverConnected = true;
                domElements.connectionStatus.className = 'status connected';
                showElement(domElements.connectionStatus, '');
                if (indicator) indicator.className = 'indicator connected';
                if (text) text.textContent = 'Connected';
                domElements.connectButton.textContent = 'Disconnect';
                domElements.connectButton.className = 'connected';
                domElements.connectButton.disabled = false;
                if (domElements.proxyConnectButton) {
                    domElements.proxyConnectButton.textContent = 'Disconnect';
                    domElements.proxyConnectButton.classList.add('connected');
                    domElements.proxyConnectButton.disabled = false;
                }
                // Reveal translation and audio steps when connected
                showElement(domElements.translationStep);
                showElement(domElements.audioStep);
                showElement(domElements.connectionStatus);
                // Two-way UI (ask) when enabled
                if (window.location.search.includes('twoWay=1')) {
                    domElements.askStep && showElement(domElements.askStep);
                    if (domElements.askSend && domElements.askInput) {
                        const hasText = domElements.askInput.value.trim().length > 0;
                        domElements.askSend.disabled = !hasText;
                        try { if (!hasText) domElements.askSend.setAttribute('disabled', 'true'); else domElements.askSend.removeAttribute('disabled'); } catch(_) {}
                    }
                    if (domElements.askPTT) domElements.askPTT.disabled = false;
                }
            } else {
                domElements.connectionStatus.className = 'status disconnected';
                if (indicator) indicator.className = 'indicator disconnected';
                if (text) text.textContent = 'Disconnected';
                domElements.connectButton.textContent = 'Connect to Session';
                domElements.connectButton.className = '';
                domElements.connectButton.disabled = !appState.selectedLanguage;
                domElements.playButton.disabled = true;
                if (domElements.proxyConnectButton) {
                    domElements.proxyConnectButton.textContent = 'Connect to Session';
                    domElements.proxyConnectButton.classList.remove('connected');
                    domElements.proxyConnectButton.disabled = !appState.selectedLanguage;
                }
                // After disconnect, keep connect step visible but hide translation/audio
                hideElement(domElements.translationStep);
                hideElement(domElements.audioStep);
                if (appState.hasEverConnected) {
                    showElement(domElements.connectionStatus);
                } else {
                    hideElement(domElements.connectionStatus);
                }
                hideElement(domElements.askStep);
            }
        },

        displayTranslation: function(data) {
            if (!domElements.translationDisplay) return;
            const originalText = data.originalText || data.original || data.sourceText || 'Unknown';
            let translatedText = 'No translation available';
            if (data.text) translatedText = data.text;
            else if (data.translatedText) translatedText = data.translatedText;
            else if (data.translated) translatedText = data.translated;
            else if (data.message) translatedText = data.message; 
            domElements.translationDisplay.innerHTML = `
                <div style="margin-bottom: 10px;">
                    <strong>Original:</strong> ${originalText}
                </div>
                <div style="margin-bottom: 10px;">
                    <strong>Translation:</strong> ${translatedText}
                </div>
            `;
            // Enable original audio button if original audio is included and feature is on
            if (domElements.playOriginalButton) {
                const hasOriginal = !!data.originalAudioData;
                domElements.playOriginalButton.disabled = !hasOriginal;
                if (hasOriginal) {
                    appState.originalAudioData = data.originalAudioData;
                    appState.originalAudioFormat = data.originalAudioFormat || 'mp3';
                }
            }
        },

        showAudioErrorInDisplay: function() {
            if (domElements.translationDisplay) {
                domElements.translationDisplay.innerHTML += '<br><em style="color: #ff6b6b;">Click the play button to hear audio</em>';
            }
        },
        
        updateGeneralStatus: function(message) { 
            if (domElements.connectionStatus) {
                const textSpan = domElements.connectionStatus.querySelector('span');
                if (textSpan) textSpan.textContent = message;
            } 
        }
    };

    const webSocketHandler = {
        connect: function(classroomCode) {
            console.log('[DEBUG] Student connect() called with classroomCode:', classroomCode);
            if (!classroomCode) {
                console.error('[DEBUG] No classroom code provided');
                uiUpdater.updateGeneralStatus('No classroom code provided for WebSocket connection.');
                return;
            }
            if (!appState.selectedLanguage) {
                console.warn('[DEBUG] No language selected; blocking connect');
                uiUpdater.updateGeneralStatus('Select a language to continue.');
                return;
            }

            console.log('[DEBUG] Selected language:', appState.selectedLanguage);
            console.log('[DEBUG] window.VITE_WS_URL:', window.VITE_WS_URL);
            
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            // TODO: Replace with injected WS URL at build time or via global variable
            if (!window.VITE_WS_URL) {
              console.error('[DEBUG] VITE_WS_URL is not set!');
              throw new Error('VITE_WS_URL must be set as a global variable or injected at build time.');
            }
            const wsUrl = window.VITE_WS_URL;
            
            console.log('[DEBUG] Connecting to WebSocket:', wsUrl, 'Lang:', appState.selectedLanguage);
            try {
                // Append twoWay flag if present in page URL to inform server
                const u = new URL(wsUrl);
                const pageUrl = new URL(window.location.href);
                const pageTwoWay = pageUrl.searchParams.get('twoWay');
                if (pageTwoWay && !u.searchParams.has('twoWay')) {
                    u.searchParams.set('twoWay', pageTwoWay);
                }
                // Pass classroom code to WS so server can associate with teacher session
                const classCode = appState.classroomCode || pageUrl.searchParams.get('code') || pageUrl.searchParams.get('class');
                if (classCode && !u.searchParams.has('code')) {
                    u.searchParams.set('code', classCode);
                }
                appState.ws = new WebSocket(u.toString());
                console.log('[DEBUG] WebSocket object created successfully');
            } catch (error) {
                console.error('[DEBUG] Error creating WebSocket:', error);
                uiUpdater.updateGeneralStatus('Error creating WebSocket connection');
                return;
            }

            appState.ws.onopen = () => {
                console.log('[DEBUG] WebSocket connected to server.');
                // Defer marking connected until register success
                uiUpdater.updateGeneralStatus('Connected to server, verifying classroom...');
                appState.isConnected = false;
                this.register(classroomCode);
            };
            appState.ws.onmessage = (event) => {
                console.log('[DEBUG] WebSocket message received:', event.data);
                this.handleMessage(event);
            };
            appState.ws.onclose = () => {
                console.log('[DEBUG] WebSocket disconnected from server.');
                uiUpdater.updateConnectionStatus(false);
                appState.isConnected = false;
                // No automatic reconnect for student, relies on manual connect button.
            };
            appState.ws.onerror = (error) => {
                console.error('[DEBUG] WebSocket error:', error);
                // Do not immediately mark as disconnected on transient errors; wait for onclose
            };
        },

        disconnect: function() {
            if (appState.ws) {
                appState.ws.close();
                // onclose handler will update status
            }
        },

        register: function(classroomCode) {
            console.log('[DEBUG] Student register() called with:', { 
                classroomCode, 
                wsReadyState: appState.ws?.readyState, 
                selectedLanguage: appState.selectedLanguage 
            });
            
            if (appState.ws && appState.ws.readyState === WebSocket.OPEN && appState.selectedLanguage) {
                let displayName = (function(){
                    try {
                        const v = (document.getElementById('student-name') || {}).value || localStorage.getItem('studentDisplayName') || '';
                        const t = String(v).trim();
                        if (t) return t;
                    } catch(_) {}
                    return '';
                })();
                const message = {
                    type: 'register',
                    role: 'student',
                    languageCode: appState.selectedLanguage,
                    classroomCode: classroomCode,
                    ...(displayName ? { name: displayName } : {})
                };
                console.log('[DEBUG] Sending student registration:', message);
                appState.ws.send(JSON.stringify(message));
                // Optional: send a ping shortly after registration
                setTimeout(() => {
                    if (appState.ws && appState.ws.readyState === WebSocket.OPEN) {
                        console.log('[DEBUG] Sending ping after registration');
                        appState.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
                    }
                }, 1000);
            } else {
                console.error('[DEBUG] Cannot register - ws state:', appState.ws?.readyState, 'lang:', appState.selectedLanguage);
            }
        },

        handleMessage: function(event) {
            const data = JSON.parse(event.data);
            switch (data.type) {
                case 'connection':
                    // Only show error if connection failed (status === 'error') or explicit error flag
                    if (data.status === 'error' || data.error) {
                        // Show nothing if the user is already connected (should not happen), else show friendly message
                        if (domElements.translationDisplay) {
                            domElements.translationDisplay.innerHTML = '<div style="color: orange;">Waiting for teacher to start the session. Please try again in a moment.</div>';
                        }
                        uiUpdater.updateConnectionStatus(false);
                        appState.isConnected = false;
                    } else {
                    // Successful join: clear any error message and show default waiting message
                    uiUpdater.updateConnectionStatus(true);
                    appState.isConnected = true;
                    try {
                        if (new URL(window.location.href).searchParams.get('twoWay') === '1') {
                            if (domElements.askStep) showElement(domElements.askStep);
                            if (domElements.askPTT) domElements.askPTT.disabled = false;
                            if (domElements.askSend && domElements.askInput) {
                                const hasText = domElements.askInput.value.trim().length > 0;
                                domElements.askSend.disabled = !hasText;
                                if (!hasText) domElements.askSend.setAttribute('disabled', 'true'); else domElements.askSend.removeAttribute('disabled');
                            }
                        }
                    } catch(_) {}
                    if (domElements.translationDisplay) {
                        domElements.translationDisplay.innerHTML = '<div style="color: #333;">Waiting for teacher to start speaking...</div>';
                    }
                    // Periodic refresh to ensure ask-send reflects current text
                    try {
                        if (!window.__askRefreshInterval) {
                            window.__askRefreshInterval = setInterval(() => {
                                if (domElements.askInput && domElements.askSend) {
                                    const hasTextNow = domElements.askInput.value.trim().length > 0;
                                    domElements.askSend.disabled = !hasTextNow;
                                    if (!hasTextNow) domElements.askSend.setAttribute('disabled', 'true'); else domElements.askSend.removeAttribute('disabled');
                                }
                            }, 300);
                        }
                    } catch(_) {}
                    }
                    break;
                case 'teacher_mode':
                    // Show waiting hint if teacher switched to manual
                    if (domElements.translationDisplay) {
                        if (data.mode === 'manual') {
                            domElements.translationDisplay.innerHTML = '<div style="color:#555;">⏳ Waiting for teacher to send…</div>';
                        } else if (!appState.isConnected) {
                            domElements.translationDisplay.innerHTML = '<div style="color:#333;">Waiting for teacher to start speaking...</div>';
                        }
                    }
                    break;
                case 'register':
                    // Only mark connected on explicit success
                    if (data.status === 'success') {
                        uiUpdater.updateConnectionStatus(true);
                        appState.isConnected = true;
                        // Enable ask UI elements when twoWay is on
                        try {
                            if (new URL(window.location.href).searchParams.get('twoWay') === '1') {
                                if (domElements.askStep) showElement(domElements.askStep);
                                if (domElements.askPTT) domElements.askPTT.disabled = false;
                                if (domElements.askSend && domElements.askInput) {
                                    const hasText = domElements.askInput.value.trim().length > 0;
                                    domElements.askSend.disabled = !hasText;
                                    if (!hasText) domElements.askSend.setAttribute('disabled', 'true'); else domElements.askSend.removeAttribute('disabled');
                                }
                            }
                        } catch(_) {}
                        if (domElements.translationDisplay) {
                            domElements.translationDisplay.innerHTML = '<div style="color:#333;">Waiting for teacher to start speaking...</div>';
                        }
                    } else {
                        uiUpdater.updateConnectionStatus(false);
                        appState.isConnected = false;
                    }
                    break;
                case 'translation':
                    uiUpdater.displayTranslation(data);
                    if (data.audioData) {
                        appState.currentAudioData = data.audioData;
                        // Infer audio format if server did not provide it
                        if (data.audioFormat) {
                            appState.currentAudioFormat = data.audioFormat;
                        } else if (typeof data.audioData === 'string') {
                            if (data.audioData.startsWith('UklG')) { // 'RIFF' => WAV
                                appState.currentAudioFormat = 'wav';
                            } else if (data.audioData.startsWith('SUQz')) { // 'ID3' => MP3
                                appState.currentAudioFormat = 'mp3';
                            } else {
                                appState.currentAudioFormat = 'mp3';
                            }
                        } else {
                            appState.currentAudioFormat = 'mp3';
                        }
                        if (domElements.playButton) domElements.playButton.disabled = false;

                        // Always attempt to play server-provided audio first
                        
                        // Check if this is browser TTS instructions
                        try {
                            const decodedData = atob(data.audioData);
                            const parsedData = JSON.parse(decodedData);
                            
                            if (parsedData.type === 'browser-speech') {
                                // Use Web Speech API for browser TTS
                                console.log('[Browser TTS] Using Web Speech API for:', parsedData.text);
                                speakWithBrowserTTS(parsedData.text, parsedData.languageCode, parsedData.autoPlay);
                            } else {
                                // Regular audio data - play as before
                                playAudio(data.audioData, appState.currentAudioFormat);
                            }
                        } catch (e) {
                            // If decoding/parsing fails, treat as regular audio
                            playAudio(data.audioData, appState.currentAudioFormat);
                        }
                    }
                    break;
                case 'error':
                    // Handle error messages properly, especially for invalid classroom codes
                    console.error('Received error from server:', data.message);
                    
                    // Show error message regardless of connection state for critical errors
                    if (data.code === 'INVALID_CLASSROOM' || data.message?.toLowerCase().includes('invalid') || data.message?.toLowerCase().includes('expired') || data.message?.toLowerCase().includes('not found')) {
                        if (domElements.translationDisplay) {
                            domElements.translationDisplay.innerHTML = `<div style=\"color: red; text-align: center; padding: 20px;\">
                                <h3>❌ Error</h3>
                                <p>${data.message}</p>
                            </div>`;
                        }
                        // Ensure UI remains disconnected (red) and allow reconnection attempt
                        uiUpdater.updateConnectionStatus(false);
                        appState.isConnected = false;
                        if (domElements.connectButton) {
                            domElements.connectButton.disabled = false;
                            domElements.connectButton.textContent = 'Connect to Session';
                            domElements.connectButton.className = '';
                        }
                    } else if (appState.isConnected) {
                        // For other errors, only show if user has tried to connect
                        if (domElements.translationDisplay) {
                            domElements.translationDisplay.innerHTML = `<div style=\"color: red;\">Error: ${data.message}</div>`;
                        }
                    } else {
                        // If not connected, show a friendly message or ignore
                        if (domElements.translationDisplay) {
                            domElements.translationDisplay.innerHTML = '<div style="color: orange;">Waiting for teacher to start the session. Please try again in a moment.</div>';
                        }
                    }
                    break;
                case 'webrtc_offer':
                case 'webrtc_answer':
                case 'webrtc_ice_candidate':
                    // Placeholder handling for future WebRTC path
                    console.log('[DEBUG] Signaling message received:', data.type);
                    break;
                default:
                    if (data.type !== 'ping' && data.type !== 'pong') {
                    console.log('Student received unknown message type:', data.type, data);
                    }
                    break;
            }
        }
    };

    document.addEventListener('DOMContentLoaded', function() {
        // Restore and persist student display name
        try {
            const nameInput = document.getElementById('student-name');
            if (nameInput) {
                const saved = localStorage.getItem('studentDisplayName') || '';
                if (saved) nameInput.value = saved;
                nameInput.addEventListener('input', () => {
                    try { localStorage.setItem('studentDisplayName', String(nameInput.value || '').trim()); } catch(_) {}
                });
            }
        } catch(_) {}
        // Cache DOM elements
        domElements.connectionStatus = document.getElementById('connection-status');
        domElements.translationDisplay = document.getElementById('translation-display');
        domElements.connectButton = document.getElementById('connect-btn');
        domElements.proxyConnectButton = document.getElementById('connect-proxy');
        domElements.languageDropdown = document.getElementById('language-dropdown');
        domElements.selectedLanguageDisplay = document.getElementById('selected-language');
        domElements.playButton = document.getElementById('play-button');
        domElements.playOriginalButton = document.getElementById('play-original-button');
        domElements.volumeControl = document.getElementById('volume-control');
        domElements.container = document.querySelector('.container');
        domElements.h1Element = document.querySelector('h1');
        domElements.languageStep = document.getElementById('language-step');
        domElements.connectStep = document.getElementById('connect-step');
        domElements.translationStep = document.getElementById('translation-step');
        domElements.audioStep = document.getElementById('audio-step');
        domElements.askStep = document.getElementById('ask-step');
        domElements.askInput = document.getElementById('ask-input');
        domElements.askSend = document.getElementById('ask-send');
        domElements.askPTT = document.getElementById('ask-ptt');

        setupLanguageSelection();

        const urlParams = new URLSearchParams(window.location.search);
        appState.classroomCode = urlParams.get('code');

        // Initial step visibility: show only language step; status/connect appear after selection
        hideElement(domElements.connectionStatus);
        hideElement(domElements.translationStep);
        hideElement(domElements.audioStep);
        hideElement(domElements.connectStep);
        if (domElements.connectButton) domElements.connectButton.disabled = true;
        if (domElements.proxyConnectButton) domElements.proxyConnectButton.disabled = true;

        if (!appState.classroomCode) {
            // Show a friendly message but do not exit; allow user to select language and see Connect
            uiUpdater.showNoClassroomCodeError();
            if (domElements.connectButton) domElements.connectButton.disabled = true;
        }

        uiUpdater.showJoiningClassroomInfo(appState.classroomCode);

        setupWebSocket();

        // Default-enable low‑literacy delivery for students (no checkbox UI)
                try {
            const tryEnableLowLiteracy = () => {
                    if (window.appState && window.appState.ws && window.appState.ws.readyState === WebSocket.OPEN) {
                    window.appState.ws.send(JSON.stringify({ type: 'settings', settings: { lowLiteracyMode: true } }));
                    return true;
                    }
                return false;
            };
            let attempts = 0; const iv = setInterval(() => { if (tryEnableLowLiteracy() || ++attempts > 30) clearInterval(iv); }, 200);
                } catch (_) {}

        // Do not reveal ask UI pre-connection; this is handled upon connection

        // Validate classroom code immediately only if a code is present
        if (appState.classroomCode) {
        validateClassroomCode(appState.classroomCode)
            .then((status) => {
                appState.isClassroomCodeValid = status;
                if (status === 'invalid') {
                    // Show immediate error UI
                    if (domElements.translationDisplay) {
                        domElements.translationDisplay.innerHTML = '<div style="color: red; text-align: center; padding: 20px;"><h3>❌ Error</h3><p>Classroom session expired or invalid. Please ask teacher for new link.</p></div>';
                    }
                    showElement(domElements.translationStep);
                    // Do NOT show status/connection bar when code is invalid
                    // Keep connect hidden/disabled
                    hideElement(domElements.connectStep);
                    if (domElements.connectButton) domElements.connectButton.disabled = true;
                    if (domElements.proxyConnectButton) domElements.proxyConnectButton.disabled = true;
                } else if (status === 'valid') {
                    // If student already selected a language quickly, enable connect
                    if (appState.selectedLanguage) {
                        showElement(domElements.connectStep);
                        if (domElements.connectButton) domElements.connectButton.disabled = false;
                        if (domElements.proxyConnectButton) domElements.proxyConnectButton.disabled = false;
                    }
                } else {
                    // Unknown - allow the guided flow and let the server enforce validity on connect
                    if (appState.selectedLanguage) {
                        showElement(domElements.connectStep);
                        if (domElements.connectButton) domElements.connectButton.disabled = false;
                        if (domElements.proxyConnectButton) domElements.proxyConnectButton.disabled = false;
                        // Only show status when language is selected (handled in language selection)
                    }
                }
            })
            .catch(() => {
                // Network issue: set unknown and allow connect after language; server will validate on register
                appState.isClassroomCodeValid = null;
                if (appState.selectedLanguage) {
                    showElement(domElements.connectStep);
                    domElements.connectButton && (domElements.connectButton.disabled = false);
                    domElements.proxyConnectButton && (domElements.proxyConnectButton.disabled = false);
                }
            });
        }
    });

    // Send student_request and setup Push-to-Talk handlers
    function setupAskHandlers() {
        // Text ask handlers (optional presence)
        if (domElements.askInput) {
        domElements.askInput.addEventListener('input', () => {
            const hasText = domElements.askInput.value.trim().length > 0;
                if (domElements.askSend) {
                    const shouldDisable = !hasText; // UI-enabled purely on text; click handler guards WS state
                    domElements.askSend.disabled = shouldDisable;
                    if (shouldDisable) {
                        try { domElements.askSend.setAttribute('disabled', 'true'); } catch (_) {}
                    } else {
                        try { domElements.askSend.removeAttribute('disabled'); } catch (_) {}
                    }
                }
            });
            // Extra resilience for environments where 'fill' may not trigger expected events
            domElements.askInput.addEventListener('keyup', () => {
                try {
                    const hasText = domElements.askInput.value.trim().length > 0;
                    if (domElements.askSend) {
                        domElements.askSend.disabled = !hasText;
                        if (!hasText) domElements.askSend.setAttribute('disabled', 'true'); else domElements.askSend.removeAttribute('disabled');
                    }
                } catch(_) {}
            });
            domElements.askInput.addEventListener('change', () => {
                try {
                    const hasText = domElements.askInput.value.trim().length > 0;
                    if (domElements.askSend) {
                        domElements.askSend.disabled = !hasText;
                        if (!hasText) domElements.askSend.setAttribute('disabled', 'true'); else domElements.askSend.removeAttribute('disabled');
                    }
                } catch(_) {}
            });
        }
        // Global fallback in case listeners above did not attach
        document.addEventListener('input', (ev) => {
            try {
                const target = ev.target;
                if (target && target.id === 'ask-input' && domElements.askSend) {
                    const hasText = String(target.value || '').trim().length > 0;
                    domElements.askSend.disabled = !hasText;
                    if (!hasText) domElements.askSend.setAttribute('disabled', 'true'); else domElements.askSend.removeAttribute('disabled');
                }
            } catch(_) {}
        });
        // Defensive: delegate click so event is captured even if handler attach fails
        const onSend = () => {
            try {
                const text = domElements.askInput ? domElements.askInput.value.trim() : '';
                if (!text) { console.warn('student_request not sent: empty text'); return; }
                if (!appState.ws || appState.ws.readyState !== WebSocket.OPEN) {
                    console.warn('student_request not sent: WebSocket not open');
                    alert('Connection not ready. Please click Connect again.');
                    return;
                }
                const vis = (document.querySelector('input[name="ask-visibility"]:checked') || {}).value || 'private';
                const msg = { type: 'student_request', text, visibility: vis };
                console.log('[student] sending student_request', msg);
                appState.ws.send(JSON.stringify(msg));
                if (domElements.askInput) domElements.askInput.value = '';
                if (domElements.askSend) domElements.askSend.disabled = true;
            } catch (e) { console.warn('Failed to send student_request', e); }
        };
        if (domElements.askSend) domElements.askSend.addEventListener('click', onSend);
        document.addEventListener('click', function(ev) {
            try {
                var tgt = ev && ev.target ? ev.target : null;
                var id = tgt && tgt.id ? tgt.id : '';
                if (id === 'ask-send') onSend();
            } catch(_) {}
        });

        // Push-to-talk (hold to send short audio, then STT on server)
        if (domElements.askPTT) {
            domElements.askPTT.disabled = true; // default disabled until connected and twoWay enabled
            let mediaRecorder = null;
            let chunks = [];
            const start = async () => {
                try {
                    const stream = await (navigator.mediaDevices && navigator.mediaDevices.getUserMedia ? navigator.mediaDevices.getUserMedia({ audio: true }) : Promise.reject(new Error('mediaDevices unavailable')));
                    mediaRecorder = new MediaRecorder(stream);
                    chunks = [];
                    mediaRecorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
                    mediaRecorder.onstop = async () => {
                        try {
                            if (chunks.length === 0) return;
                            const blob = new Blob(chunks, { type: (mediaRecorder && mediaRecorder.mimeType) || 'audio/webm' });
                            const reader = new FileReader();
                            reader.onloadend = () => {
                                const base64Audio = String(reader.result).split(',')[1];
                                const vis = (document.querySelector('input[name="ask-visibility"]:checked') || {}).value || 'private';
                                const msg = { type: 'student_audio', data: base64Audio, language: appState.selectedLanguage, visibility: vis };
                                try { appState.ws && appState.ws.readyState === WebSocket.OPEN && appState.ws.send(JSON.stringify(msg)); } catch (_) {}
                            };
                            reader.readAsDataURL(blob);
                        } catch (_) {}
                    };
                    mediaRecorder.start();
                } catch (e) { console.warn('PTT start failed', e); }
            };
            const stop = () => { try { mediaRecorder && mediaRecorder.state === 'recording' && mediaRecorder.stop(); } catch(_) {} };
            domElements.askPTT.title = 'Hold to record your voice and send to the teacher (v8)';
            domElements.askPTT.addEventListener('mousedown', start);
            domElements.askPTT.addEventListener('touchstart', start);
            domElements.askPTT.addEventListener('mouseup', stop);
            domElements.askPTT.addEventListener('mouseleave', stop);
            domElements.askPTT.addEventListener('touchend', stop);
        }
    }

    setupAskHandlers();

    function autoSelectFirstLanguage() { /* intentionally disabled for guided UX */ }

    function setupLanguageSelection() {
        if (!domElements.languageDropdown) return;
        domElements.languageDropdown.addEventListener('change', function() {
            const selectedOption = this.options[this.selectedIndex];
            if (selectedOption.value) {
                appState.selectedLanguage = selectedOption.value;
                uiUpdater.updateSelectedLanguageDisplay(selectedOption.textContent);
                    if (domElements.connectButton) domElements.connectButton.disabled = false;
                    if (domElements.proxyConnectButton) domElements.proxyConnectButton.disabled = false;
                    domElements.connectStep?.classList.remove('hidden');
                // Keep status hidden until connected
                if (appState.selectedLanguage && appState.ws && appState.ws.readyState === WebSocket.OPEN && appState.isConnected) {
                    console.log('Language changed while connected - re-registering with server');
                    webSocketHandler.register(appState.classroomCode); // Call new handler
                }
            } else {
                appState.selectedLanguage = null;
                uiUpdater.updateSelectedLanguageDisplay(null);
                if (domElements.connectButton) domElements.connectButton.disabled = true;
                if (domElements.proxyConnectButton) domElements.proxyConnectButton.disabled = true;
                domElements.connectStep?.classList.add('hidden');
            }
        });
    }

    function setupWebSocket() {
        if (domElements.connectButton) {
            domElements.connectButton.title = 'Connect to your classroom session (v8)';
            domElements.connectButton.addEventListener('click', toggleConnection);
        }
        if (domElements.playButton) {
            domElements.playButton.title = 'Play the translated audio (v8)';
            domElements.playButton.addEventListener('click', playCurrentAudio);
        }
        if (domElements.playOriginalButton) {
            domElements.playOriginalButton.title = 'Play the teacher\'s original voice (AI) (v8)';
            domElements.playOriginalButton.addEventListener('click', playOriginalAudio);
        }
        const dl = document.getElementById('download-audio');
        if (dl) {
            dl.addEventListener('click', function() {
                try {
                    if (!appState.currentAudioBlobUrl) return;
                    const a = document.createElement('a');
                    a.href = appState.currentAudioBlobUrl;
                    a.download = 'tts.mp3';
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => document.body.removeChild(a), 0);
                } catch (e) { console.error('Download failed', e); }
            });
        }
    }

    function toggleConnection() {
        console.log('[DEBUG] toggleConnection() called, isConnected:', appState.isConnected);
        if (appState.isConnected) {
            console.log('[DEBUG] Disconnecting...');
            webSocketHandler.disconnect();
        } else {
            if (appState.isClassroomCodeValid === 'invalid') {
                uiUpdater.updateGeneralStatus('Invalid classroom code.');
                return;
            }
            if (!appState.selectedLanguage) {
                uiUpdater.updateGeneralStatus('Select a language to continue.');
                return;
            }
            console.log('[DEBUG] Connecting with classroomCode:', appState.classroomCode);
            webSocketHandler.connect(appState.classroomCode);
        }
    }

    async function validateClassroomCode(classroomCode) {
        try {
            const baseUrl = window.VITE_API_URL || '';
            const res = await fetch(`${baseUrl}/api/sessions/active`, { credentials: 'same-origin' });
            if (!res.ok) return false;
            const json = await res.json();
            const active = (json && json.data && Array.isArray(json.data.activeSessions)) ? json.data.activeSessions : [];
            const isActive = active.some(s => (s.classCode || '').trim() === String(classroomCode || '').trim());
            return isActive ? 'valid' : 'invalid';
        } catch (e) {
            console.error('Classroom validation failed:', e);
            return null; // unknown
        }
    }

    function playAudio(audioBase64, audioFormat = 'mp3') {
        try {
            const mime = audioFormat === 'wav' ? 'audio/wav' : 'audio/mpeg';
            // Prefer Blob URL for better browser compatibility with larger payloads
            const binary = atob(audioBase64);
            const len = binary.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
            const blob = new Blob([bytes], { type: mime });
            const url = URL.createObjectURL(blob);
            const audio = new Audio();
            audio.src = url;
            appState.currentAudioBlobUrl = url;
            // Ensure volume is a proper number in [0,1]
            if (domElements.volumeControl) {
                const vol = parseFloat(domElements.volumeControl.value);
                audio.volume = Number.isFinite(vol) ? Math.max(0, Math.min(1, vol)) : 1;
            } else {
                audio.volume = 1;
            }
            audio.onerror = function(e) {
                console.error('Audio play error (blob URL):', e);
                // Fallback to data URI if blob URL fails
                try {
                    audio.src = `data:${mime};base64,${audioBase64}`;
                    audio.load();
                    audio.play().catch(err => {
                        console.error('Audio play failed (data URI):', err);
                        uiUpdater.showAudioErrorInDisplay();
                    });
                } catch (err2) {
                    console.error('Audio fallback failed:', err2);
                    uiUpdater.showAudioErrorInDisplay();
                }
            };
            audio.oncanplay = function() { console.log('[Audio Debug] canplay, duration:', audio.duration); };
            audio.onplay = function() { console.log('[Audio Debug] play started'); };
            audio.onended = function() { try { URL.revokeObjectURL(url); } catch (_) {} };
            audio.load();
            audio.play().catch(e => {
                console.error('Audio play failed (blob URL):', e);
                uiUpdater.showAudioErrorInDisplay();
            });
        } catch (error) {
            console.error('Error creating audio:', error);
            uiUpdater.showAudioErrorInDisplay();
        }
    }

    function playOriginalAudio() {
        try {
            if (!appState.originalAudioData) return;
            playAudio(appState.originalAudioData, appState.originalAudioFormat || 'mp3');
        } catch (_) {}
    }

    function speakWithBrowserTTS(text, languageCode, autoPlay = true) {
        try {
            // Check if speech synthesis is available
            if (!('speechSynthesis' in window)) {
                console.warn('Speech Synthesis API not supported in this browser');
                uiUpdater.showAudioErrorInDisplay();
                return;
            }

            // Cancel any ongoing speech
            window.speechSynthesis.cancel();

            // Create speech utterance
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = languageCode;
            
            // Set volume based on control
            if (domElements.volumeControl) {
                utterance.volume = parseFloat(domElements.volumeControl.value);
            }

            // Set voice if available
            const voices = window.speechSynthesis.getVoices();
            const matchingVoice = voices.find(voice => voice.lang === languageCode);
            if (matchingVoice) {
                utterance.voice = matchingVoice;
            }

            // Event handlers
            utterance.onstart = () => {
                console.log('[Browser TTS] Speech started');
            };
            
            utterance.onend = () => {
                console.log('[Browser TTS] Speech ended');
            };
            
            utterance.onerror = (e) => {
                console.error('[Browser TTS] Speech error:', e);
                uiUpdater.showAudioErrorInDisplay();
            };

            // Speak the text
            if (autoPlay) {
                window.speechSynthesis.speak(utterance);
                console.log(`[Browser TTS] Speaking: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}" in ${languageCode}`);
            }

            // Store the utterance for manual playback
            appState.currentBrowserTTS = {
                text,
                languageCode,
                utterance: utterance
            };

        } catch (error) {
            console.error('Error with browser TTS:', error);
            uiUpdater.showAudioErrorInDisplay();
        }
    }

    // Removed silent-audio heuristic to prefer server audio playback consistently

    function playCurrentAudio() {
        if (appState.currentAudioData) {
            // Check if this is browser TTS instructions
            try {
                const decodedData = atob(appState.currentAudioData);
                const parsedData = JSON.parse(decodedData);
                
                if (parsedData.type === 'browser-speech') {
                    // Replay browser TTS
                    speakWithBrowserTTS(parsedData.text, parsedData.languageCode, true);
                } else {
                    // Regular audio data
                    playAudio(appState.currentAudioData, appState.currentAudioFormat || 'mp3');
                }
            } catch (e) {
                // If decoding/parsing fails, treat as regular audio
                playAudio(appState.currentAudioData, appState.currentAudioFormat || 'mp3');
            }
        }
    }

    // Expose for testing/mocking if needed
    if (typeof window !== 'undefined') {
        window.handleWebSocketMessage = (data) => webSocketHandler.handleMessage({data: JSON.stringify(data)}); // Adapt if test calls with object
        window.appState = appState;
    }

})(); // End of IIFE