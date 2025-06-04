// Diagnostics Dashboard JavaScript
let autoRefreshInterval = null;
let isAutoRefreshEnabled = false;

// DOM Elements
const statusElement = document.getElementById('status');
const errorContainer = document.getElementById('error-container');
const debugContainer = document.getElementById('debug-container');
const metricsContainer = document.getElementById('metrics-container');
const lastUpdatedElement = document.getElementById('last-updated');
const systemStatusElement = document.getElementById('system-status');
const autoRefreshBtn = document.getElementById('auto-refresh-btn');

// Utility Functions
function showError(message) {
    errorContainer.innerHTML = `<div class="error-message">${message}</div>`;
}

function clearError() {
    errorContainer.innerHTML = '';
}

function showDebug(info) {
    debugContainer.innerHTML = `<div class="debug-info">${JSON.stringify(info, null, 2)}</div>`;
}

function clearDebug() {
    debugContainer.innerHTML = '';
}

function updateStatus(message, type = 'info') {
    statusElement.textContent = message;
    statusElement.className = `status status-${type}`;
}

function updateSystemStatus(status, type = 'good') {
    systemStatusElement.textContent = status;
    systemStatusElement.className = `status-${type}`;
}

// Create metric cards
function createMetricCard(title, data) {
    const card = document.createElement('div');
    card.className = 'metric-card';
    
    let html = `<h3>${title}</h3>`;
    
    if (typeof data === 'object' && data !== null) {
        Object.entries(data).forEach(([key, value]) => {
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                return; // Skip complex objects
            }
            
            // Format the key to be more readable
            const formattedKey = key
                .replace(/([A-Z])/g, ' $1')
                .replace(/^./, str => str.toUpperCase())
                .replace('By Role', '');
            
            html += `
                <div class="metric-item">
                    <span class="metric-label">
                        <span class="status-indicator status-good"></span>
                        ${formattedKey}
                    </span>
                    <span class="metric-value">${value}</span>
                </div>
            `;
        });
    } else {
        html += '<div class="metric-item">No data available</div>';
    }
    
    card.innerHTML = html;
    return card;
}

function createConnectionMetricsCard(title, data) {
    const card = document.createElement('div');
    card.className = 'metric-card';
    card.setAttribute('data-testid', 'connection-metrics');
    
    let html = `<h3>${title}</h3>`;
    
    if (data) {
        html += `
            <div class="metric-item">
                <span class="metric-label">
                    <span class="status-indicator status-good"></span>
                    Total Connections
                </span>
                <span class="metric-value">${data.total || 0}</span>
            </div>
            <div class="metric-item">
                <span class="metric-label">
                    <span class="status-indicator ${data.active > 0 ? 'status-good' : 'status-warning'}"></span>
                    Active Connections
                </span>
                <span class="metric-value">${data.active || 0}</span>
            </div>
            <div class="metric-item">
                <span class="metric-label">
                    <span class="status-indicator status-good"></span>
                    Teachers Connected
                </span>
                <span class="metric-value">${data.teachers || 0}</span>
            </div>
            <div class="metric-item">
                <span class="metric-label">
                    <span class="status-indicator status-good"></span>
                    Students Connected
                </span>
                <span class="metric-value">${data.students || 0}</span>
            </div>
        `;
    } else {
        html += '<div class="metric-item">No connection data available</div>';
    }
    
    card.innerHTML = html;
    return card;
}

function createSessionMetricsCard(title, data) {
    const card = document.createElement('div');
    card.className = 'metric-card';
    card.setAttribute('data-testid', 'session-metrics');
    
    let html = `<h3>${title}</h3>`;
    
    if (data) {
        html += `
            <div class="metric-item">
                <span class="metric-label">
                    <span class="status-indicator ${data.activeSessions > 0 ? 'status-good' : 'status-warning'}"></span>
                    Active Sessions
                </span>
                <span class="metric-value">${data.activeSessions || 0}</span>
            </div>
            <div class="metric-item">
                <span class="metric-label">
                    <span class="status-indicator status-good"></span>
                    Total Sessions
                </span>
                <span class="metric-value">${data.totalSessions || 0}</span>
            </div>
            <div class="metric-item">
                <span class="metric-label">
                    <span class="status-indicator status-good"></span>
                    Average Session Duration
                </span>
                <span class="metric-value">${data.averageSessionDurationFormatted || 'N/A'}</span>
            </div>
            <div class="metric-item">
                <span class="metric-label">
                    <span class="status-indicator status-good"></span>
                    Sessions (Last 24h)
                </span>
                <span class="metric-value">${data.sessionsLast24Hours || 0}</span>
            </div>
        `;
    } else {
        html += '<div class="metric-item">No session data available</div>';
    }
    
    card.innerHTML = html;
    return card;
}

function createTranslationMetricsCard(title, data) {
    const card = document.createElement('div');
    card.className = 'metric-card';
    card.setAttribute('data-testid', 'translation-metrics');
    
    let html = `<h3>${title}</h3>`;
    
    if (data) {
        const latencyStatus = data.averageTime < 1000 ? 'status-good' : 
                            data.averageTime < 2000 ? 'status-warning' : 'status-error';
        
        html += `
            <div class="metric-item">
                <span class="metric-label">
                    <span class="status-indicator status-good"></span>
                    Real-time Translations
                </span>
                <span class="metric-value">${data.total || 0}</span>
            </div>
            <div class="metric-item">
                <span class="metric-label">
                    <span class="status-indicator ${latencyStatus}"></span>
                    Average Latency
                </span>
                <span class="metric-value">${data.averageTimeFormatted || 'N/A'}</span>
            </div>
            <div class="metric-item">
                <span class="metric-label">
                    <span class="status-indicator status-good"></span>
                    Translations (Last 24h)
                </span>
                <span class="metric-value">${data.translationsLast24Hours || 0}</span>
            </div>
            <div class="metric-item">
                <span class="metric-label">
                    <span class="status-indicator status-good"></span>
                    Translations (Last Hour)
                </span>
                <span class="metric-value">${data.translationsLastHour || 0}</span>
            </div>
        `;
    } else {
        html += '<div class="metric-item">No translation data available</div>';
    }
    
    card.innerHTML = html;
    return card;
}

function createUsageMetricsCard(title, data) {
    const card = document.createElement('div');
    card.className = 'metric-card';
    card.setAttribute('data-testid', 'usage-metrics');
    
    let html = `<h3>${title}</h3>`;
    
    if (data) {
        html += `
            <div class="metric-item">
                <span class="metric-label">
                    <span class="status-indicator status-good"></span>
                    Peak Concurrent Users
                </span>
                <span class="metric-value">${data.peakConcurrentUsers || 0}</span>
            </div>
            <div class="metric-item">
                <span class="metric-label">
                    <span class="status-indicator status-good"></span>
                    Unique Teachers Today
                </span>
                <span class="metric-value">${data.uniqueTeachersToday || 0}</span>
            </div>
            <div class="metric-item">
                <span class="metric-label">
                    <span class="status-indicator status-good"></span>
                    Unique Students Today
                </span>
                <span class="metric-value">${data.uniqueStudentsToday || 0}</span>
            </div>
            <div class="metric-item">
                <span class="metric-label">
                    <span class="status-indicator status-good"></span>
                    Average Session Length
                </span>
                <span class="metric-value">${data.averageSessionLengthFormatted || 'N/A'}</span>
            </div>
            <div class="metric-item">
                <span class="metric-label">
                    <span class="status-indicator status-good"></span>
                    Total Transcriptions
                </span>
                <span class="metric-value">${data.totalTranscriptions || 0}</span>
            </div>
        `;
        
        // Show most active language pairs if available
        if (data.mostActiveLanguagePairs && data.mostActiveLanguagePairs.length > 0) {
            html += '<div class="language-pair-section">';
            html += '<div class="language-pair-title">Most Active Language Pairs:</div>';
            data.mostActiveLanguagePairs.forEach(pair => {
                html += `
                    <div class="metric-item language-pair-item">
                        <span class="metric-label">
                            ${pair.sourceLanguage} → ${pair.targetLanguage}
                        </span>
                        <span class="metric-value">${pair.count} translations</span>
                    </div>
                `;
            });
            html += '</div>';
        }
    } else {
        html += '<div class="metric-item">No usage data available</div>';
    }
    
    card.innerHTML = html;
    return card;
}

// API Functions
async function testAPI() {
    updateStatus('Testing API connection...', 'info');
    clearDebug();
    
    try {
        const response = await fetch('/api/health');
        const data = await response.json();
        
        showDebug({
            status: 'API test successful',
            health: data,
            timestamp: new Date().toISOString()
        });
        
        updateStatus('API test completed successfully', 'good');
        updateSystemStatus('Operational', 'good');
    } catch (error) {
        showDebug({
            status: 'API test failed',
            error: error.message,
            timestamp: new Date().toISOString()
        });
        
        updateStatus('API test failed', 'error');
        updateSystemStatus('Connection Error', 'error');
    }
}

async function loadDiagnostics() {
    updateStatus('Loading diagnostics data...', 'info');
    clearError();
    
    try {
        console.log('Fetching diagnostics from /api/diagnostics');
        const response = await fetch('/api/diagnostics');
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        console.log('Diagnostics data received:', data);
        
        displayDiagnostics(data);
        updateStatus('Diagnostics loaded successfully', 'good');
        updateSystemStatus('Operational', 'good');
    } catch (error) {
        console.error('Error loading diagnostics:', error);
        showError(`Failed to load diagnostics: ${error.message}`);
        updateStatus('Failed to load diagnostics', 'error');
        updateSystemStatus('Data Error', 'error');
    }
}

function displayDiagnostics(data) {
    metricsContainer.innerHTML = '';
    
    // Connection metrics
    if (data.connections) {
        const connectionCard = createConnectionMetricsCard('🔌 Connection Status', data.connections);
        metricsContainer.appendChild(connectionCard);
    }
    
    // Session metrics
    if (data.sessions) {
        const sessionCard = createSessionMetricsCard('📚 Session Metrics', data.sessions);
        metricsContainer.appendChild(sessionCard);
    }
    
    // Translation metrics
    if (data.translations) {
        const translationCard = createTranslationMetricsCard('🌐 Translation Performance', data.translations);
        metricsContainer.appendChild(translationCard);
    }
    
    // Usage metrics
    if (data.usage) {
        const usageCard = createUsageMetricsCard('📈 Usage & Adoption', data.usage);
        metricsContainer.appendChild(usageCard);
    }
    
    // Audio metrics
    if (data.audio) {
        const audioCard = createMetricCard('🔊 Audio Generation', data.audio);
        metricsContainer.appendChild(audioCard);
    }
    
    // System metrics
    if (data.system) {
        const systemCard = createMetricCard('💻 System Health', data.system);
        metricsContainer.appendChild(systemCard);
    }
    
    // Update last updated time
    if (data.lastUpdated) {
        const updateTime = new Date(data.lastUpdated).toLocaleString();
        lastUpdatedElement.innerHTML = `Last updated: ${updateTime}`;
    }
}

async function exportDiagnostics() {
    try {
        updateStatus('Exporting diagnostics...', 'info');
        console.log('Exporting diagnostics...');
        
        const response = await fetch('/api/diagnostics/export');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Create and download JSON file
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `diagnostics-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('Diagnostics exported successfully');
        updateStatus('Diagnostics exported successfully', 'good');
    } catch (error) {
        console.error('Error exporting diagnostics:', error);
        showError(`Failed to export diagnostics: ${error.message}`);
        updateStatus('Export failed', 'error');
    }
}

function toggleAutoRefresh() {
    if (isAutoRefreshEnabled) {
        // Disable auto-refresh
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
        isAutoRefreshEnabled = false;
        autoRefreshBtn.textContent = '⏰ Auto-refresh: OFF';
        autoRefreshBtn.classList.remove('active');
        updateStatus('Auto-refresh disabled', 'info');
    } else {
        // Enable auto-refresh
        autoRefreshInterval = setInterval(loadDiagnostics, 5000); // Refresh every 5 seconds
        isAutoRefreshEnabled = true;
        autoRefreshBtn.textContent = '⏰ Auto-refresh: ON';
        autoRefreshBtn.classList.add('active');
        updateStatus('Auto-refresh enabled (5s interval)', 'good');
    }
}

// Event listeners
document.getElementById('refresh-btn').addEventListener('click', loadDiagnostics);
document.getElementById('test-api-btn').addEventListener('click', testAPI);
document.getElementById('export-btn').addEventListener('click', exportDiagnostics);
document.getElementById('auto-refresh-btn').addEventListener('click', toggleAutoRefresh);

// Load initial data
document.addEventListener('DOMContentLoaded', () => {
    loadDiagnostics();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
}); 