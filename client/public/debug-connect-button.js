/**
 * Simple Standalone Debug Script for AIVoiceTranslator Connect Button
 * 
 * This script adds enhanced debugging capabilities to detect issues with 
 * the WebSocket connection in the student interface.
 */

// Add global debug functions
window.debugWebSocket = function() {
    if (!window.socket) {
        console.log('WebSocket Status: No socket created');
        alert('WebSocket Status: No socket created');
        return;
    }
    
    const states = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];
    const stateStr = states[window.socket.readyState] || 'UNKNOWN';
    
    console.log(`WebSocket Status: ${stateStr} (${window.socket.readyState})`);
    alert(`WebSocket Status: ${stateStr} (${window.socket.readyState})`);
};

// Add debug UI elements
function addDebugElements() {
    console.log('Adding debug elements to page');
    
    // Add Debug button
    const debugButton = document.createElement('button');
    debugButton.innerText = 'Debug WebSocket';
    debugButton.style.position = 'fixed';
    debugButton.style.top = '10px';
    debugButton.style.right = '10px';
    debugButton.style.zIndex = '9999';
    debugButton.style.padding = '5px 10px';
    debugButton.style.backgroundColor = '#f8f9fa';
    debugButton.style.border = '1px solid #dee2e6';
    debugButton.style.borderRadius = '4px';
    debugButton.style.cursor = 'pointer';
    debugButton.style.fontSize = '12px';
    debugButton.onclick = window.debugWebSocket;
    document.body.appendChild(debugButton);
    
    // Create debug panel
    const debugPanel = document.createElement('div');
    debugPanel.id = 'debug-panel';
    debugPanel.style.position = 'fixed';
    debugPanel.style.bottom = '0';
    debugPanel.style.left = '0';
    debugPanel.style.right = '0';
    debugPanel.style.backgroundColor = '#000';
    debugPanel.style.color = '#0f0';
    debugPanel.style.padding = '10px';
    debugPanel.style.fontSize = '12px';
    debugPanel.style.fontFamily = 'monospace';
    debugPanel.style.zIndex = '9999';
    debugPanel.style.maxHeight = '150px';
    debugPanel.style.overflowY = 'auto';
    debugPanel.style.opacity = '0.9';
    
    // Add debug info
    debugPanel.innerHTML = `
        <strong>Browser Info:</strong> ${navigator.userAgent}<br>
        <strong>Protocol:</strong> ${window.location.protocol}<br>
        <strong>Host:</strong> ${window.location.host}<br>
        <strong>WebSocket URL:</strong> ${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws<br>
        <button onclick="this.parentNode.style.display='none'" style="position:absolute;top:5px;right:5px;background:#f00;color:#fff;border:none;padding:2px 5px;">X</button>
    `;
    
    document.body.appendChild(debugPanel);
    
    // Hook into the Connect button
    setTimeout(() => {
        const connectBtn = document.getElementById('connect-btn');
        if (connectBtn) {
            console.log('Found Connect button, adding debug hooks');
            const originalOnClick = connectBtn.onclick;
            
            connectBtn.onclick = function(event) {
                console.warn('🛠️ DEBUG: Connect button clicked');
                
                // Log WebSocket status before connecting
                if (window.socket) {
                    const states = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];
                    const stateStr = states[window.socket.readyState] || 'UNKNOWN';
                    console.warn(`🛠️ DEBUG: WebSocket state before connect: ${stateStr} (${window.socket.readyState})`);
                } else {
                    console.warn('🛠️ DEBUG: No WebSocket instance exists yet');
                }
                
                // Call the original handler
                if (typeof originalOnClick === 'function') {
                    console.warn('🛠️ DEBUG: Calling original connect handler');
                    originalOnClick.call(this, event);
                }
                
                // Check status after connecting
                setTimeout(() => {
                    if (window.socket) {
                        const states = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];
                        const stateStr = states[window.socket.readyState] || 'UNKNOWN';
                        console.warn(`🛠️ DEBUG: WebSocket state after connect: ${stateStr} (${window.socket.readyState})`);
                    } else {
                        console.warn('🛠️ DEBUG: No WebSocket instance exists after connect');
                    }
                }, 500);
            };
        } else {
            console.warn('Connect button not found!');
        }
    }, 1000);
}

// Add our debug elements when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addDebugElements);
} else {
    addDebugElements();
}

// Patch WebSocket constructor for diagnostic purposes
(function() {
    const originalWebSocket = window.WebSocket;
    window.WebSocket = function(url, protocols) {
        console.warn('🛠️ DEBUG: WebSocket constructor called', url);
        
        try {
            const socket = new originalWebSocket(url, protocols);
            
            // Add extra debug logging
            const originalOnOpen = socket.onopen;
            socket.onopen = function(event) {
                console.warn('🛠️ DEBUG: WebSocket.onopen fired', event);
                if (typeof originalOnOpen === 'function') {
                    originalOnOpen.call(this, event);
                }
            };
            
            const originalOnClose = socket.onclose;
            socket.onclose = function(event) {
                console.warn('🛠️ DEBUG: WebSocket.onclose fired', event);
                if (typeof originalOnClose === 'function') {
                    originalOnClose.call(this, event);
                }
            };
            
            const originalOnError = socket.onerror;
            socket.onerror = function(event) {
                console.error('🛠️ DEBUG: WebSocket.onerror fired', event);
                if (typeof originalOnError === 'function') {
                    originalOnError.call(this, event);
                }
            };
            
            // Log when send is called
            const originalSend = socket.send;
            socket.send = function(data) {
                console.warn('🛠️ DEBUG: WebSocket.send called', data);
                return originalSend.call(this, data);
            };
            
            return socket;
        } catch (error) {
            console.error('🛠️ CRITICAL: Error creating WebSocket', error);
            throw error;
        }
    };
    
    // Copy static properties
    window.WebSocket.CONNECTING = originalWebSocket.CONNECTING;
    window.WebSocket.OPEN = originalWebSocket.OPEN;
    window.WebSocket.CLOSING = originalWebSocket.CLOSING;
    window.WebSocket.CLOSED = originalWebSocket.CLOSED;
    
    console.warn('🛠️ DEBUG: WebSocket constructor patched for diagnostics');
})();
