import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'wouter';
import { useWebSocket } from '../hooks/useWebSocket';
import { clientConfig } from '../config/client-config';

const Teacher: React.FC = () => {
  const [classroomCode, setClassroomCode] = useState<string>('');
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('en-US');
  const [ttsService, setTtsService] = useState('browser');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const [requests, setRequests] = useState<Array<{ requestId: string; name?: string; languageCode?: string; text: string }>>([]);

  const { isConnected, sendMessage } = useWebSocket({
    onOpen: () => {
      // Register as teacher when connected
      sendMessage({
        type: 'register',
        role: 'teacher',
        languageCode: selectedLanguage,
        ttsService: ttsService
      });
    },
    onMessage: (data) => {
      if (data.type === 'classroom_code') {
        setClassroomCode(data.code);
      } else if (data.type === 'error') {
        setError(data.message);
      } else if (clientConfig.features.twoWayCommunication && data.type === 'student_request') {
        const p = data.payload || {};
        setRequests(prev => [{ requestId: p.requestId, name: p.name, languageCode: p.languageCode, text: p.text }, ...prev].slice(0, 50));
      }
    }
  });

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        
        reader.onloadend = () => {
          const base64Audio = reader.result?.toString().split(',')[1];
          if (base64Audio) {
            sendMessage({
              type: 'audio',
              audio: base64Audio,
              mimeType: 'audio/webm'
            });
          }
        };
        
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setError('');
    } catch (err) {
      setError('Failed to access microphone. Please ensure you have granted permission.');
      console.error('Error accessing microphone:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLanguage = e.target.value;
    setSelectedLanguage(newLanguage);
    
    // Update registration with new language
    if (isConnected) {
      sendMessage({
        type: 'register',
        role: 'teacher',
        languageCode: newLanguage,
        ttsService: ttsService
      });
    }
  };

  const handleTtsServiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newService = e.target.value;
    setTtsService(newService);
    
    // Update registration with new TTS service
    if (isConnected) {
      sendMessage({
        type: 'register',
        role: 'teacher',
        languageCode: selectedLanguage,
        ttsService: newService
      });
    }
  };

  return (
    <div className="container">
      <Link href="/" className="btn" style={{ marginBottom: '20px' }}>← Back to Home</Link>
      
      <h1>Teacher Interface</h1>
      
      <div className={`status ${isConnected ? 'connected' : 'disconnected'}`}>
        {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
      </div>

      {error && <div className="error">{error}</div>}

      {classroomCode && (
        <div className="classroom-code">
          <h2>Classroom Code</h2>
          <div className="code-display">{classroomCode}</div>
          <p>Share this code with your students</p>
        </div>
      )}

      <div className="language-selector">
        <label htmlFor="language">Your Language:</label>
        <select 
          id="language" 
          value={selectedLanguage} 
          onChange={handleLanguageChange}
        >
          <option value="en-US">English (US)</option>
          <option value="es-ES">Spanish</option>
          <option value="fr-FR">French</option>
          <option value="de-DE">German</option>
          <option value="it-IT">Italian</option>
          <option value="pt-BR">Portuguese (Brazil)</option>
          <option value="ru-RU">Russian</option>
          <option value="zh-CN">Chinese (Mandarin)</option>
          <option value="ja-JP">Japanese</option>
          <option value="ko-KR">Korean</option>
          <option value="ar-SA">Arabic</option>
          <option value="hi-IN">Hindi</option>
        </select>
      </div>

      <div className="language-selector">
        <label htmlFor="tts-service">Text-to-Speech Service:</label>
        <select 
          id="tts-service" 
          value={ttsService} 
          onChange={handleTtsServiceChange}
        >
          <option value="browser">Browser (Free)</option>
          <option value="openai">OpenAI (Premium)</option>
        </select>
      </div>

      <div className="controls">
        <button 
          className="btn" 
          onClick={isRecording ? stopRecording : startRecording}
          disabled={!isConnected}
        >
          {isRecording ? '⏹️ Stop Recording' : '🎤 Start Recording'}
        </button>
      </div>

      <div className="transcript-container">
        <h3>Your Speech (Transcribed):</h3>
        <div id="transcript">{transcript || 'Start speaking to see transcription...'}</div>
      </div>

      {clientConfig.features.twoWayCommunication && (
        <div className="requests-panel" style={{ marginTop: 20 }}>
          <h3>Student Requests</h3>
          {requests.length === 0 && <div>No requests yet</div>}
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {requests.map((r) => (
              <li key={r.requestId} style={{ borderBottom: '1px solid #eee', padding: '8px 0' }}>
                <div style={{ fontWeight: 600 }}>{r.name || 'Unknown Student'} <span style={{ color: '#666' }}>{r.languageCode ? `(${r.languageCode})` : ''}</span></div>
                <div style={{ margin: '4px 0' }}>{r.text}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn" onClick={() => sendMessage({ type: 'teacher_reply', text: 'I will explain next', scope: 'class' })}>Reply to class</button>
                  <button className="btn" onClick={() => sendMessage({ type: 'teacher_reply', text: 'I will help you now', scope: 'private', requestId: r.requestId })}>Reply privately</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default Teacher; 