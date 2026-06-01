document.addEventListener('DOMContentLoaded', () => {
    const statusDot = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    const connectBtn = document.getElementById('connect-btn');
    const codeInput = document.getElementById('classroom-code');
    const transcriptStream = document.getElementById('transcript-stream');
    const auditStream = document.getElementById('audit-stream');
    
    let ws = null;

    connectBtn.addEventListener('click', () => {
        const code = codeInput.value.trim().toUpperCase();
        if (!code) return alert('Enter a classroom code');
        connect(code);
    });

    function connect(classroomCode) {
        if (ws) ws.close();
        
        const wsUrl = window.VITE_WS_URL || `ws://${window.location.host}`;
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            statusDot.classList.add('connected');
            statusText.textContent = `Connected to ${classroomCode}`;
            
            // Register as an 'observer' role so we get all translations and audits
            ws.send(JSON.stringify({
                type: 'register',
                role: 'student', // Use student role so we receive translations
                languageCode: 'en-US', // Default to English for observer
                classroomCode: classroomCode,
                name: 'Observability Dashboard'
            }));
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            if (data.type === 'translation') {
                appendTranscript(data.originalText, data.text);
                
                // If the backend sent auditReceipts (because an agent action triggered)
                if (data.auditReceipts && data.auditReceipts.length > 0) {
                    data.auditReceipts.forEach(receipt => appendAudit(receipt));
                }
            }
        };

        ws.onclose = () => {
            statusDot.classList.remove('connected');
            statusText.textContent = 'Disconnected';
        };

        ws.onerror = (err) => {
            console.error('WebSocket Error:', err);
        };
    }

    function appendTranscript(original, translated) {
        const el = document.createElement('div');
        el.className = 'log-entry';
        const time = new Date().toLocaleTimeString();
        el.innerHTML = `
            <div class="log-time">[${time}]</div>
            <div><strong>Source:</strong> ${original}</div>
            <div style="color: #79c0ff;"><strong>Translated:</strong> ${translated}</div>
        `;
        transcriptStream.prepend(el);
    }

    function appendAudit(receipt) {
        const el = document.createElement('div');
        el.className = 'log-entry';
        const time = new Date(receipt.timestamp).toLocaleTimeString();
        
        const rulesHtml = receipt.ltlRulesChecked.map(r => `<div>&nbsp;&nbsp;⊢ ${r}</div>`).join('');
        
        el.innerHTML = `
            <div class="log-time">[${time}] <span class="log-tag audit">AEGIS-12 VERIFY</span> <span class="log-tag pass">PASSED</span></div>
            <div><strong>Action:</strong> ${receipt.agentActionType}</div>
            <div><strong>LTL Verification:</strong></div>
            <div style="color: #a5d6ff; font-family: monospace;">${rulesHtml}</div>
            <div style="color: #d2a8ff; margin-top: 5px;"><strong>EU AI Act Alignment:</strong> ${receipt.euAiActClause}</div>
            <div style="margin-top: 5px; font-size: 0.9em; color: #8b949e;">${receipt.details}</div>
            <div style="margin-top: 8px;"><strong>Audit Hash:</strong> <span class="hash">${receipt.hash}</span></div>
        `;
        auditStream.prepend(el);
    }
});
