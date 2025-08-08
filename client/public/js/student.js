(function() { // Start of IIFE
    const appState = {
        ws: null,
        selectedLanguage: null,
        currentAudioData: null,
        currentBrowserTTS: null, // Store browser TTS utterance for replay
        isConnected: false,
        classroomCode: null // Will get this from URL params
    };

    const domElements = {
        connectionStatus: null,
        translationDisplay: null,
        connectButton: null,
        languageDropdown: null,
        selectedLanguageDisplay: null,
        playButton: null,
        volumeControl: null,
        container: null, // For inserting classroomInfo
        h1Element: null // For inserting classroomInfo
    };

    const uiUpdater = {
        showNoClassroomCodeError: function() {
            if (domElements.connectionStatus) {
                domElements.connectionStatus.innerHTML = `
                    <div class="indicator disconnected"></div>
                    <span>No classroom code provided</span>
                `;
            }
            if (domElements.translationDisplay) {
                domElements.translationDisplay.innerHTML = 
                    '<div style="color: red; text-align: center; padding: 20px;">' +
                    '<h3>❌ Missing Classroom Code</h3>' +
                    '<p>Please get the correct link from your teacher.</p>' +
                    '<p>The link should look like: <code>/student?code=ABC123</code></p>' +
                    '</div>';
            }
            if (domElements.connectButton) domElements.connectButton.disabled = true;
        },

        showJoiningClassroomInfo: function(classroomCode) {
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
                domElements.selectedLanguageDisplay.textContent = languageName ? `Selected: ${languageName}` : 'No language selected';
            }
        },

        updateConnectionStatus: function(connected) {
            if (!domElements.connectionStatus || !domElements.connectButton || !domElements.playButton) return;
            const indicator = domElements.connectionStatus.querySelector('.indicator');
            const text = domElements.connectionStatus.querySelector('span');
            appState.isConnected = connected;
            if (connected) {
                domElements.connectionStatus.className = 'status connected';
                if (indicator) indicator.className = 'indicator connected';
                if (text) text.textContent = 'Connected';
                domElements.connectButton.textContent = 'Disconnect';
                domElements.connectButton.className = 'connected';
                domElements.connectButton.disabled = false;
            } else {
                domElements.connectionStatus.className = 'status disconnected';
                if (indicator) indicator.className = 'indicator disconnected';
                if (text) text.textContent = 'Disconnected';
                domElements.connectButton.textContent = 'Connect to Session';
                domElements.connectButton.className = '';
                domElements.connectButton.disabled = !appState.selectedLanguage;
                domElements.playButton.disabled = true;
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
                console.log('[DEBUG] No language selected, auto-selecting first option before WebSocket connect');
                autoSelectFirstLanguage(); // This function should ensure appState.selectedLanguage is set
            }
            if (!appState.selectedLanguage) { // Fallback if autoSelect failed or wasn't possible
                console.log('[DEBUG] Auto-select failed, using Spanish fallback');
                appState.selectedLanguage = 'es'; 
                uiUpdater.updateSelectedLanguageDisplay('Spanish (Default)');
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
                appState.ws = new WebSocket(wsUrl);
                console.log('[DEBUG] WebSocket object created successfully');
            } catch (error) {
                console.error('[DEBUG] Error creating WebSocket:', error);
                uiUpdater.updateGeneralStatus('Error creating WebSocket connection');
                return;
            }

            appState.ws.onopen = () => {
                console.log('[DEBUG] WebSocket connected to server.');
                uiUpdater.updateConnectionStatus(true);
                appState.isConnected = true;
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
                const message = {
                    type: 'register',
                    role: 'student',
                    languageCode: appState.selectedLanguage,
                    classroomCode: classroomCode 
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
                    // Only show error if connection failed (status === 'error'), otherwise clear any error
                    if (data.status === 'error' || data.error || data.message) {
                        // Show nothing if the user is already connected (should not happen), else show friendly message
                        if (domElements.translationDisplay) {
                            domElements.translationDisplay.innerHTML = '<div style="color: orange;">Waiting for teacher to start the session. Please try again in a moment.</div>';
                        }
                        uiUpdater.updateConnectionStatus(false);
                        appState.isConnected = false;
                    } else {
                        // Successful join: clear any error message and show default waiting message
                        if (domElements.translationDisplay) {
                            domElements.translationDisplay.innerHTML = '<div style="color: #333;">Waiting for teacher to start speaking...</div>';
                        }
                    }
                    break;
                case 'register':
                    break;
                case 'translation':
                    uiUpdater.displayTranslation(data);
                    if (data.audioData) {
                        appState.currentAudioData = data.audioData;
                        if (domElements.playButton) domElements.playButton.disabled = false;
                        
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
                                playAudio(data.audioData);
                            }
                        } catch (e) {
                            // If decoding/parsing fails, treat as regular audio
                            playAudio(data.audioData);
                        }
                    }
                    break;
                case 'error':
                    // Handle error messages properly, especially for invalid classroom codes
                    console.error('Received error from server:', data.message);
                    
                    // Show error message regardless of connection state for critical errors
                    if (data.code === 'INVALID_CLASSROOM' || data.message?.includes('invalid') || data.message?.includes('expired')) {
                        if (domElements.translationDisplay) {
                            domElements.translationDisplay.innerHTML = `<div style=\"color: red; text-align: center; padding: 20px;\">
                                <h3>❌ Error</h3>
                                <p>${data.message}</p>
                            </div>`;
                        }
                        if (domElements.connectButton) domElements.connectButton.disabled = true;
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
                default:
                    if (data.type !== 'ping' && data.type !== 'pong') {
                    console.log('Student received unknown message type:', data.type, data);
                    }
                    break;
            }
        }
    };

    document.addEventListener('DOMContentLoaded', function() {
        // Cache DOM elements
        domElements.connectionStatus = document.getElementById('connection-status');
        domElements.translationDisplay = document.getElementById('translation-display');
        domElements.connectButton = document.getElementById('connect-btn');
        domElements.languageDropdown = document.getElementById('language-dropdown');
        domElements.selectedLanguageDisplay = document.getElementById('selected-language');
        domElements.playButton = document.getElementById('play-button');
        domElements.volumeControl = document.getElementById('volume-control');
        domElements.container = document.querySelector('.container');
        domElements.h1Element = document.querySelector('h1');

        setupLanguageSelection();

        const urlParams = new URLSearchParams(window.location.search);
        appState.classroomCode = urlParams.get('code');

        if (!appState.classroomCode) {
            uiUpdater.showNoClassroomCodeError();
            if (domElements.connectButton) domElements.connectButton.disabled = true;
            return;
        }

        uiUpdater.showJoiningClassroomInfo(appState.classroomCode);

        setupWebSocket();

        // Do NOT auto-connect. Wait for user to select language and click connect.
        autoSelectFirstLanguage();
        if (domElements.connectButton) domElements.connectButton.disabled = false;
        // No auto-connect or auto-register here. Only connect on button click.
    });

    function autoSelectFirstLanguage() {
        if (domElements.languageDropdown && !appState.selectedLanguage) {
            const firstOption = domElements.languageDropdown.options[1]; 
            if (firstOption) {
                domElements.languageDropdown.value = firstOption.value;
                appState.selectedLanguage = firstOption.value;
                uiUpdater.updateSelectedLanguageDisplay(firstOption.textContent);
                if (domElements.connectButton) domElements.connectButton.disabled = false;
            }
        }
    }

    function setupLanguageSelection() {
        if (!domElements.languageDropdown) return;
        domElements.languageDropdown.addEventListener('change', function() {
            const selectedOption = this.options[this.selectedIndex];
            if (selectedOption.value) {
                appState.selectedLanguage = selectedOption.value;
                uiUpdater.updateSelectedLanguageDisplay(selectedOption.textContent);
                if (domElements.connectButton) domElements.connectButton.disabled = false;
                if (appState.selectedLanguage && appState.ws && appState.ws.readyState === WebSocket.OPEN && appState.isConnected) {
                    console.log('Language changed while connected - re-registering with server');
                    webSocketHandler.register(appState.classroomCode); // Call new handler
                }
            } else {
                appState.selectedLanguage = null;
                uiUpdater.updateSelectedLanguageDisplay(null);
                if (domElements.connectButton) domElements.connectButton.disabled = true;
            }
        });
    }

    function setupWebSocket() {
        if (domElements.connectButton) domElements.connectButton.addEventListener('click', toggleConnection);
        if (domElements.playButton) domElements.playButton.addEventListener('click', playCurrentAudio);
    }

    function toggleConnection() {
        console.log('[DEBUG] toggleConnection() called, isConnected:', appState.isConnected);
        if (appState.isConnected) {
            console.log('[DEBUG] Disconnecting...');
            webSocketHandler.disconnect();
        } else {
            console.log('[DEBUG] Connecting with classroomCode:', appState.classroomCode);
            webSocketHandler.connect(appState.classroomCode);
        }
    }

    function playAudio(audioBase64) {
        try {
            const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
            if (domElements.volumeControl) audio.volume = domElements.volumeControl.value;
            audio.onerror = function(e) { console.error('Audio play error:', e); };
            audio.play().catch(e => {
                console.error('Audio play failed:', e);
                uiUpdater.showAudioErrorInDisplay();
            });
        } catch (error) {
            console.error('Error creating audio:', error);
        }
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
                    playAudio(appState.currentAudioData);
                }
            } catch (e) {
                // If decoding/parsing fails, treat as regular audio
                playAudio(appState.currentAudioData);
            }
        }
    }

    // Expose for testing/mocking if needed
    if (typeof window !== 'undefined') {
        window.handleWebSocketMessage = (data) => webSocketHandler.handleMessage({data: JSON.stringify(data)}); // Adapt if test calls with object
    }

})(); // End of IIFE