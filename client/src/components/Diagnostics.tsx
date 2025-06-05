import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';

interface DiagnosticsData {
  connections: any;
  translations: any;
  audio: any;
  systemHealth: any;
  recentSessionActivity: any[];
  languagePairMetrics: any[];
}

const Diagnostics: React.FC = () => {
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchDiagnostics = async () => {
    try {
      const response = await fetch('/api/diagnostics');
      if (!response.ok) throw new Error('Failed to fetch diagnostics');
      const diagnosticsData = await response.json();
      setData(diagnosticsData);
      setError('');
    } catch (err) {
      setError('Failed to load diagnostics data');
      console.error('Error fetching diagnostics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
    
    if (autoRefresh) {
      const interval = setInterval(fetchDiagnostics, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const exportData = () => {
    if (!data) return;
    
    const dataStr = JSON.stringify(data, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `analytics-export-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  if (loading) {
    return (
      <div className="container">
        <div style={{ textAlign: 'center', padding: '50px' }}>
          Loading diagnostics data...
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <Link href="/" className="btn" style={{ marginBottom: '20px' }}>← Back to Home</Link>
      
      <h1>Analytics Dashboard</h1>
      <p style={{ color: '#666', marginBottom: '30px' }}>
        Real-time usage metrics and adoption analytics
      </p>

      {error && <div className="error">{error}</div>}

      <div className="controls">
        <button className="btn" onClick={fetchDiagnostics}>
          Refresh Data
        </button>
        <button className="btn" onClick={exportData} disabled={!data}>
          Export Data
        </button>
        <button 
          className="btn" 
          onClick={() => setAutoRefresh(!autoRefresh)}
          style={{ backgroundColor: autoRefresh ? '#10b981' : '#2563eb' }}
        >
          Auto-refresh: {autoRefresh ? 'ON' : 'OFF'}
        </button>
      </div>

      {data && (
        <>
          <section style={{ marginTop: '30px' }}>
            <h2>Product Adoption Metrics</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginTop: '20px' }}>
              <div className="card">
                <h3>Total Sessions</h3>
                <div style={{ fontSize: '2em', fontWeight: 'bold' }}>
                  {data.connections.totalSessions}
                </div>
              </div>
              <div className="card">
                <h3>Active Users</h3>
                <div style={{ fontSize: '2em', fontWeight: 'bold' }}>
                  {data.connections.activeConnections}
                </div>
              </div>
              <div className="card">
                <h3>Translation Volume</h3>
                <div style={{ fontSize: '2em', fontWeight: 'bold' }}>
                  {data.translations.totalTranslations}
                </div>
              </div>
            </div>
          </section>

          <section style={{ marginTop: '30px' }}>
            <h2>Performance Metrics</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginTop: '20px' }}>
              <div className="card">
                <h3>System Health</h3>
                <div style={{ fontSize: '1.5em', color: '#10b981' }}>
                  {data.systemHealth.status}
                </div>
                <div style={{ fontSize: '0.9em', color: '#666' }}>
                  Uptime: {data.systemHealth.uptime}
                </div>
              </div>
              <div className="card">
                <h3>Audio Generation</h3>
                <div style={{ fontSize: '1.5em' }}>
                  {data.audio.totalGenerated}
                </div>
                <div style={{ fontSize: '0.9em', color: '#666' }}>
                  Cache Size: {data.audio.cacheSize}
                </div>
              </div>
              <div className="card">
                <h3>Avg Latency</h3>
                <div style={{ fontSize: '1.5em' }}>
                  {data.translations.averageLatency}ms
                </div>
              </div>
            </div>
          </section>

          {data.languagePairMetrics && data.languagePairMetrics.length > 0 && (
            <section style={{ marginTop: '30px' }}>
              <h2>Language Pair Usage</h2>
              <table style={{ width: '100%', marginTop: '20px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Source</th>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Target</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>Count</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>Avg Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {data.languagePairMetrics.map((pair, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '10px' }}>{pair.sourceLanguage}</td>
                      <td style={{ padding: '10px' }}>{pair.targetLanguage}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>{pair.count}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>{pair.averageLatency}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <section style={{ marginTop: '30px' }}>
            <h2>Recent Session Activity</h2>
            <div style={{ marginTop: '20px' }}>
              {data.recentSessionActivity && data.recentSessionActivity.length > 0 ? (
                data.recentSessionActivity.map((session, index) => (
                  <div key={index} style={{ padding: '10px', borderBottom: '1px solid #e5e7eb' }}>
                    <strong>Session {session.sessionId}</strong> - 
                    {session.language} - 
                    {session.transcriptCount} transcripts - 
                    {new Date(session.lastActivity).toLocaleString()}
                  </div>
                ))
              ) : (
                <div style={{ color: '#666' }}>No recent session activity</div>
              )}
            </div>
          </section>
        </>
      )}

      <div style={{ marginTop: '30px', fontSize: '0.9em', color: '#666', textAlign: 'center' }}>
        Last updated: {new Date().toLocaleString()}
      </div>
    </div>
  );
};

export default Diagnostics; 