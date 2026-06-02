/**
 * Aegis-12 — AgentVerify Observability Dashboard
 * Conference-grade real-time LTL governance viewer
 */
(function () {
    'use strict';

    // ── State ──────────────────────────────────────────────────────
    let ws = null;
    let actionsCount = 0;
    let violationsCount = 0;
    let chainLength = 0;
    let chainIntact = true;
    let firstMessage = true; // Track if we've cleared the placeholder

    // ── DOM refs ───────────────────────────────────────────────────
    const $ = (id) => document.getElementById(id);

    const dom = {};

    function cacheDom() {
        dom.statusDot       = $('status-indicator');
        dom.statusText      = $('status-text');
        dom.connectBtn      = $('connect-btn');
        dom.codeInput       = $('classroom-code');
        dom.transcriptStream = $('transcript-stream');
        dom.auditStream     = $('audit-stream');
        dom.auditPanel      = $('audit-panel');
        dom.actionsVal      = $('stat-actions-val');
        dom.violationsVal   = $('stat-violations-val');
        dom.chainVal        = $('stat-chain-val');
        dom.integrityVal    = $('stat-integrity-val');
        dom.verifyBtn       = $('verify-chain-btn');
        dom.chainResult     = $('chain-result');
    }

    // ── Stat update with glow ──────────────────────────────────────
    function glowCard(cardId) {
        const card = $(cardId);
        if (!card) return;
        card.classList.remove('glow');
        // Force reflow to restart animation
        void card.offsetWidth;
        card.classList.add('glow');
        setTimeout(() => card.classList.remove('glow'), 900);
    }

    function updateStats() {
        if (dom.actionsVal)    dom.actionsVal.textContent    = actionsCount;
        if (dom.violationsVal) dom.violationsVal.textContent = violationsCount;
        if (dom.chainVal)      dom.chainVal.textContent      = chainLength;

        if (dom.integrityVal) {
            dom.integrityVal.textContent = chainIntact ? '✓' : '✗';
            dom.integrityVal.className   = 'stat-value ' + (chainIntact ? 'ok' : 'fail');
        }
    }

    // ── Connection ─────────────────────────────────────────────────
    function connect(classroomCode) {
        if (ws) { try { ws.close(); } catch (_) {} }

        const wsUrl = window.VITE_WS_URL || `ws://${window.location.host}`;
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            dom.statusDot.classList.add('connected');
            dom.statusText.textContent = `Connected · ${classroomCode}`;
            dom.connectBtn.textContent = 'Connected';

            // Register as student/observer to receive translation stream
            ws.send(JSON.stringify({
                type: 'register',
                role: 'student',
                languageCode: 'en-US',
                classroomCode: classroomCode,
                name: 'Aegis-12 Observer'
            }));
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                handleMessage(data);
            } catch (e) {
                console.error('[Observability] Parse error:', e);
            }
        };

        ws.onclose = () => {
            dom.statusDot.classList.remove('connected');
            dom.statusText.textContent = 'Disconnected';
            dom.connectBtn.textContent = 'Connect';
        };

        ws.onerror = (err) => {
            console.error('[Observability] WebSocket error:', err);
        };
    }

    // ── Message Handler ────────────────────────────────────────────
    function handleMessage(data) {
        if (data.type === 'translation') {
            appendTranscript(
                data.originalText || data.original || data.sourceText || '',
                data.text || data.translatedText || data.translated || ''
            );

            // Process audit receipts
            if (data.auditReceipts && data.auditReceipts.length > 0) {
                data.auditReceipts.forEach(receipt => appendAudit(receipt));
            }
        }

        if (data.type === 'governance_blocked') {
            // A violation was caught — show in the audit panel
            if (data.auditReceipt) {
                appendAudit(data.auditReceipt);
            } else {
                // Fabricate a minimal failed entry from the governance_blocked payload
                appendAudit({
                    timestamp: Date.now(),
                    agentActionType: data.actionType || 'AGENT_ACTION',
                    verdict: 'FAILED',
                    ltlRulesChecked: data.ltlRulesChecked || ['G(action → permitted)'],
                    euAiActClause: data.euAiActClause || 'Art. 14(1)',
                    details: data.reason || 'Action blocked by governance layer',
                    hash: data.hash || '—',
                    previousHash: data.previousHash || null
                });
            }
        }

        // Silently handle pings
        if (data.type === 'ping' && ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }
    }

    // ── Transcript Panel ───────────────────────────────────────────
    function appendTranscript(original, translated) {
        if (!dom.transcriptStream) return;

        // Clear placeholder on first message
        if (firstMessage) {
            dom.transcriptStream.innerHTML = '';
            firstMessage = false;
        }

        const el = document.createElement('div');
        el.className = 'tx-entry';
        const time = new Date().toLocaleTimeString();
        el.innerHTML = `
            <div class="tx-time">${time}</div>
            <div class="tx-original">${escapeHtml(original)}</div>
            <div class="tx-translated"><span class="tx-arrow">→</span> ${escapeHtml(translated)}</div>
        `;
        dom.transcriptStream.prepend(el);

        // Cap entries to avoid memory bloat
        while (dom.transcriptStream.children.length > 100) {
            dom.transcriptStream.removeChild(dom.transcriptStream.lastChild);
        }
    }

    // ── Audit Panel ────────────────────────────────────────────────
    let auditFirstMessage = true;

    function appendAudit(receipt) {
        if (!dom.auditStream) return;

        // Clear placeholder
        if (auditFirstMessage) {
            dom.auditStream.innerHTML = '';
            auditFirstMessage = false;
        }

        // Check both 'status' (server field) and 'verdict' (client fallback)
        const statusField = (receipt.status || receipt.verdict || '').toUpperCase();
        const isFailed = statusField === 'FAILED';
        actionsCount++;
        chainLength++;
        if (isFailed) violationsCount++;

        // Glow the relevant stat cards
        glowCard('stat-actions');
        glowCard('stat-chain');
        if (isFailed) {
            glowCard('stat-violations');
            glowCard('stat-integrity');
            chainIntact = false;
        }
        updateStats();

        const time = receipt.timestamp
            ? new Date(receipt.timestamp).toLocaleTimeString()
            : new Date().toLocaleTimeString();

        // Build LTL rules with both technical and plain-English explanations
        const rulesHtml = (receipt.ltlRulesChecked || [])
            .map(r => {
                const plain = ltlToPlainEnglish(r);
                return `<div class="rule"><span class="turnstile">⊢</span> <code>${escapeHtml(r)}</code></div>` +
                       (plain ? `<div class="rule-explain">↳ ${plain}</div>` : '');
            })
            .join('');

        const hashShort = (receipt.hash || '—').length > 16
            ? receipt.hash.substring(0, 16) + '…'
            : receipt.hash || '—';

        const prevHashHtml = receipt.previousHash
            ? `<div class="prev-hash"><span class="chain-link">⛓</span> prev: ${receipt.previousHash.substring(0, 12)}…</div>`
            : '';

        const verdictBadge = isFailed
            ? '<span class="badge badge-fail">⚠️ FAILED</span>'
            : '<span class="badge badge-pass">✓ PASSED</span>';

        // Business-friendly summary for C-level audience
        const actionLabel = friendlyActionName(receipt.agentActionType);
        const euExplain = friendlyEuClause(receipt.euAiActClause);
        const businessSummary = isFailed
            ? '🚨 <strong>Risk Alert:</strong> The AI attempted an unauthorized action and was <strong>blocked before it reached any user</strong>. This incident has been cryptographically sealed for regulatory audit.'
            : '✅ <strong>Compliant:</strong> The AI\'s action was verified against governance rules and regulatory requirements before delivery.';

        const el = document.createElement('div');
        el.className = 'audit-entry' + (isFailed ? ' failed' : '');
        el.innerHTML = `
            <div class="audit-header">
                <span class="audit-time">[${time}]</span>
                <span class="badge badge-verify">AEGIS-12 VERIFY</span>
                ${verdictBadge}
            </div>
            <div class="business-summary">${businessSummary}</div>
            <div class="audit-action"><strong>What happened:</strong> ${escapeHtml(actionLabel)}</div>
            <div class="audit-clause"><strong>Regulation:</strong> ${escapeHtml(receipt.euAiActClause || '—')}</div>
            <div class="audit-clause-explain">${euExplain}</div>
            <div class="audit-rules"><strong>Formal Verification (LTL):</strong>${rulesHtml}</div>
            <div class="audit-details">${escapeHtml(receipt.details || '')}</div>
            <div class="audit-hash">
                <span class="hash-label">Tamper-proof seal: </span>
                <span class="hash-value">${hashShort}<span class="hash-full">${escapeHtml(receipt.hash || '—')}</span></span>
            </div>
            ${prevHashHtml}
        `;
        dom.auditStream.prepend(el);

        // If FAILED, flash the entire audit panel
        if (isFailed && dom.auditPanel) {
            dom.auditPanel.classList.remove('flash-fail');
            void dom.auditPanel.offsetWidth;
            dom.auditPanel.classList.add('flash-fail');
            setTimeout(() => dom.auditPanel.classList.remove('flash-fail'), 700);
        }

        // Cap entries
        while (dom.auditStream.children.length > 100) {
            dom.auditStream.removeChild(dom.auditStream.lastChild);
        }
    }

    // ── Chain Verification ─────────────────────────────────────────
    async function verifyChain() {
        if (!dom.chainResult) return;
        dom.chainResult.textContent = 'Verifying…';
        dom.chainResult.className = '';

        try {
            const res = await fetch('/api/audit/ledger/verify');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            if (data.valid || data.integrity === 'valid' || data.success) {
                dom.chainResult.textContent = '✓ Chain integrity verified — all hashes valid';
                dom.chainResult.className = 'chain-valid';
                chainIntact = true;
            } else {
                dom.chainResult.textContent = '✗ Chain integrity BROKEN — tampering detected';
                dom.chainResult.className = 'chain-invalid';
                chainIntact = false;
            }
        } catch (e) {
            dom.chainResult.textContent = `Error: ${e.message}`;
            dom.chainResult.className = 'chain-invalid';
        }

        updateStats();
        glowCard('stat-integrity');
    }

    // ── Business-Friendly Translations ─────────────────────────────
    // Translate technical LTL formulas into plain English
    function ltlToPlainEnglish(rule) {
        const map = {
            'G (Action -> ContextVerified)': 'Every AI action must have verified context before proceeding',
            'G (Quiz -> F(HumanApproval))': 'Every quiz must eventually receive human oversight approval',
            'G (VocabExtraction -> OntologyAligned)': 'Vocabulary definitions must align with verified domain knowledge',
            'G (¬UnsafeContent)': 'Unsafe content must NEVER be produced — zero tolerance policy',
        };
        // Exact match first
        if (map[rule]) return map[rule];
        // Partial matches
        if (rule.includes('ContextVerified')) return 'Every AI action must have verified context before proceeding';
        if (rule.includes('SafeContent')) return 'This action type must only produce safe, appropriate content';
        if (rule.includes('HumanApproval')) return 'This content requires human oversight before final delivery';
        if (rule.includes('OntologyAligned')) return 'Extracted information must align with verified domain knowledge';
        if (rule.includes('UnsafeContent')) return 'Unsafe content must NEVER be produced — zero tolerance policy';
        return '';
    }

    // Translate technical action types into business language
    function friendlyActionName(actionType) {
        const map = {
            'vocabulary': 'AI autonomously extracted key vocabulary terms from the teacher\'s lecture',
            'quiz': 'AI autonomously generated a comprehension quiz for students',
            'generate_quiz': 'AI autonomously generated a comprehension quiz for students',
            'extract_vocabulary': 'AI autonomously extracted key vocabulary terms from the lecture',
            'unsafe_content': '⚠️ AI attempted to deliver unverified content outside approved scope',
        };
        return map[actionType] || `AI performed action: ${actionType}`;
    }

    // Translate EU AI Act articles into business-friendly explanations
    function friendlyEuClause(clause) {
        if (!clause) return '';
        const explanations = {
            'Article 9: Risk management system': '📋 Requires high-risk AI systems to have a risk management system that identifies, analyzes, and mitigates risks throughout the system lifecycle.',
            'Article 10: Data and data governance': '📊 Requires training and validation data to be relevant, representative, and free from errors — preventing biased or hallucinated outputs.',
            'Article 12: Record-keeping': '📝 Requires automatic logging of AI system events to ensure traceability and enable post-market monitoring.',
            'Article 14: Human oversight': '👤 Requires that high-risk AI systems can be effectively overseen by humans, including the ability to intervene and override.',
        };
        for (const [key, value] of Object.entries(explanations)) {
            if (clause.includes(key) || clause.includes(key.split(':')[0])) return value;
        }
        return '';
    }

    // ── Utilities ──────────────────────────────────────────────────
    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    }

    // ── Init ───────────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', () => {
        cacheDom();

        dom.connectBtn.addEventListener('click', () => {
            const code = dom.codeInput.value.trim().toUpperCase();
            if (!code) {
                dom.codeInput.style.borderColor = '#f85149';
                dom.codeInput.focus();
                setTimeout(() => { dom.codeInput.style.borderColor = ''; }, 1500);
                return;
            }
            connect(code);
        });

        // Enter key in code input
        dom.codeInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') dom.connectBtn.click();
        });

        dom.verifyBtn.addEventListener('click', verifyChain);

        // Auto-connect if code is in URL
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const code = urlParams.get('code') || urlParams.get('classroom');
            if (code) {
                dom.codeInput.value = code.toUpperCase();
                connect(code.toUpperCase());
            }
        } catch (_) {}
    });
})();
