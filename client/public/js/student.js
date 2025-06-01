(function() { // Start of IIFE
    const appState = {
        ws: null,
        selectedLanguage: null,
        currentAudioData: null,
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
            if (!classroomCode) {
                uiUpdater.updateGeneralStatus('No classroom code provided for WebSocket connection.');
                return;
            }
            if (!appState.selectedLanguage) {
                console.log('No language selected, auto-selecting first option before WebSocket connect');
                autoSelectFirstLanguage(); // This function should ensure appState.selectedLanguage is set
            }
            if (!appState.selectedLanguage) { // Fallback if autoSelect failed or wasn't possible
                appState.selectedLanguage = 'es'; 
                uiUpdater.updateSelectedLanguageDisplay('Spanish (Default)');
            }

            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            // Ensure classroomCode for WebSocket URL matches server expectation (e.g. ?code= or ?class=)
            // Based on server/routes.ts /join route and student.html URL parsing, 'code' is used.
            // WebSocketServer.ts also parses for 'class' or 'code'. Using 'code' for consistency.
            const wsUrl = `${protocol}//${window.location.host}/ws?code=${classroomCode}`;
            
            // console.log('Connecting to WebSocket:', wsUrl, 'Lang:', appState.selectedLanguage);
            appState.ws = new WebSocket(wsUrl);

            appState.ws.onopen = () => {
                // console.log('WebSocket connected to server.');
                uiUpdater.updateConnectionStatus(true);
                appState.isConnected = true;
                this.register(classroomCode);
            };
            appState.ws.onmessage = (event) => this.handleMessage(event);
            appState.ws.onclose = () => {
                // console.log('WebSocket disconnected from server.');
                uiUpdater.updateConnectionStatus(false);
                appState.isConnected = false;
                // No automatic reconnect for student, relies on manual connect button.
            };
            appState.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                uiUpdater.updateConnectionStatus(false);
                appState.isConnected = false;
            };
        },

        disconnect: function() {
            if (appState.ws) {
                appState.ws.close();
                // onclose handler will update status
            }
        },

        register: function(classroomCode) {
            if (appState.ws && appState.ws.readyState === WebSocket.OPEN && appState.selectedLanguage) {
                const message = {
                    type: 'register',
                    role: 'student',
                    languageCode: appState.selectedLanguage,
                    classroomCode: classroomCode 
                };
                // console.log('Sending student registration:', message);
                appState.ws.send(JSON.stringify(message));
                // Optional: send a ping shortly after registration
                setTimeout(() => {
                    if (appState.ws && appState.ws.readyState === WebSocket.OPEN) {
                        appState.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
                    }
                }, 1000);
            }
        },

        handleMessage: function(event) {
            const data = JSON.parse(event.data);
            // console.log('Student received message:', data);
            switch (data.type) {
                case 'connection': // Server confirms WebSocket connection
                    // console.log('Server confirmed WebSocket connection.');
                    // Registration is typically done onopen or by explicit user action (connect button)
                    // If server expects re-registration on this, ensure classroomCode is available.
                    // this.register(appState.classroomCode); 
                    break;
                case 'register': // Confirmation of student registration
                    // if (data.status === 'success') console.log('Student registration successful with server.');
                    // else console.error('Student registration failed with server:', data);
                    break;
                case 'translation':
                    uiUpdater.displayTranslation(data);
                    if (data.audioData) {
                        appState.currentAudioData = data.audioData;
                        if (domElements.playButton) domElements.playButton.disabled = false;
                        playAudio(data.audioData); 
                    }
                    break;
                case 'error':
                    console.error('Received error from server:', data.message);
                    if (domElements.translationDisplay) {
                        domElements.translationDisplay.innerHTML = `<div style="color: red;">Error: ${data.message}</div>`;
                    }
                    // Potentially update connection status to disconnected if error is severe
                    // uiUpdater.updateConnectionStatus(false); 
                    // appState.isConnected = false;
                    break;
                // Student typically doesn't need to handle incoming pings or send pongs explicitly
                // unless server requires it for keep-alive beyond standard WebSocket pings.
                default:
                    // console.log('Student received unknown message type:', data.type, data);
                    if (data.text || data.translatedText || data.message) {
                        uiUpdater.displayTranslation(data);
                    }
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
            return;
        }
        
        uiUpdater.showJoiningClassroomInfo(appState.classroomCode);
        
        setupWebSocket();
        
        setTimeout(() => {
            autoSelectFirstLanguage();
            if (domElements.connectButton) domElements.connectButton.disabled = false;
        }, 100);
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
        if (appState.isConnected) webSocketHandler.disconnect();
        else webSocketHandler.connect(appState.classroomCode);
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

    function playCurrentAudio() {
        if (appState.currentAudioData) playAudio(appState.currentAudioData);
    }

    // Expose for testing/mocking if needed
    if (typeof window !== 'undefined') {
        window.handleWebSocketMessage = (data) => webSocketHandler.handleMessage({data: JSON.stringify(data)}); // Adapt if test calls with object
    }

})(); // End of IIFE 