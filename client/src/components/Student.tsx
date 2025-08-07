import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearch } from 'wouter';
import { useWebSocket } from '../hooks/useWebSocket';

const Student: React.FC = () => {
  const searchParams = useSearch();
  const urlParams = new URLSearchParams(searchParams);
  const classroomCodeFromUrl = urlParams.get('code') || '';
  
  const [classroomCode, setClassroomCode] = useState(classroomCodeFromUrl);
  const [selectedLanguage, setSelectedLanguage] = useState('es-ES');
  const [translations, setTranslations] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);

  const { isConnected, sendMessage } = useWebSocket({
    onOpen: () => {
      // Auto-join if classroom code is provided
      if (classroomCodeFromUrl) {
        joinClassroom();
      }
    },
    onMessage: (data) => {
      if (data.type === 'translation') {
        setTranslations(prev => [...prev, data.text]);
        
        // Play audio if provided
        if (data.audioData) {
          playAudio(data.audioData);
        }
      } else if (data.type === 'error') {
        setError(data.message);
      } else if (data.type === 'register' && data.status === 'success') {
        setIsJoined(true);
        setError('');
      }
    }
  });

  const joinClassroom = () => {
    if (!classroomCode) {
      setError('Please enter a classroom code');
      return;
    }

    sendMessage({
      type: 'register',
      role: 'student',
      languageCode: selectedLanguage,
      classroomCode: classroomCode
    });
  };

  const playAudio = (base64Audio: string) => {
    try {
      // Check if this is browser TTS instructions
      try {
        const decodedData = atob(base64Audio);
        const parsedData = JSON.parse(decodedData);
        
        if (parsedData.type === 'browser-speech') {
          // Use Web Speech API for browser TTS
          console.log('[Browser TTS] Using Web Speech API for:', parsedData.text);
          speakWithBrowserTTS(parsedData.text, parsedData.languageCode, true);
          return;
        }
      } catch (e) {
        // If decoding/parsing fails, treat as regular audio
      }
      
      // Regular audio data - play as MP3
      const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`);
      audio.play().catch(err => {
        console.error('Error playing audio:', err);
      });
    } catch (err) {
      console.error('Error creating audio:', err);
    }
  };

  const speakWithBrowserTTS = (text: string, languageCode: string, autoPlay: boolean = true) => {
    try {
      // Check if speech synthesis is available
      if (!('speechSynthesis' in window)) {
        console.warn('Speech Synthesis API not supported in this browser');
        return;
      }

      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      // Create speech utterance
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = languageCode;

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
      };

      // Speak the text
      if (autoPlay) {
        window.speechSynthesis.speak(utterance);
        console.log(`[Browser TTS] Speaking: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}" in ${languageCode}`);
      }

    } catch (error) {
      console.error('Error with browser TTS:', error);
    }
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLanguage = e.target.value;
    setSelectedLanguage(newLanguage);
    
    // Update registration if already joined
    if (isJoined && isConnected) {
      sendMessage({
        type: 'register',
        role: 'student',
        languageCode: newLanguage,
        classroomCode: classroomCode
      });
    }
  };

  const clearTranslations = () => {
    setTranslations([]);
  };

  return (
    <div className="container">
      <Link href="/" className="btn" style={{ marginBottom: '20px' }}>← Back to Home</Link>
      
      <h1>Student Interface</h1>
      
      <div className={`status ${isConnected ? 'connected' : 'disconnected'}`}>
        {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
      </div>

      {error && <div className="error">{error}</div>}

      {!isJoined ? (
        <div className="classroom-code">
          <h2>Join Classroom</h2>
          <input
            type="text"
            value={classroomCode}
            onChange={(e) => setClassroomCode(e.target.value.toUpperCase())}
            placeholder="Enter classroom code"
            style={{
              fontSize: '24px',
              padding: '10px',
              textAlign: 'center',
              textTransform: 'uppercase',
              letterSpacing: '2px',
              width: '100%',
              maxWidth: '300px',
              margin: '10px 0'
            }}
          />
          <button 
            className="btn" 
            onClick={joinClassroom}
            disabled={!isConnected || !classroomCode}
          >
            Join Classroom
          </button>
        </div>
      ) : (
        <div className="classroom-code">
          <h2>Joined Classroom</h2>
          <div className="code-display">{classroomCode}</div>
        </div>
      )}

      <div className="language-selector">
        <label htmlFor="language">Your Language:</label>
        <select 
          id="language" 
          value={selectedLanguage} 
          onChange={handleLanguageChange}
        >
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
          <option value="en-US">English (US)</option>
        </select>
      </div>

      <div className="controls">
        <button 
          className="btn" 
          onClick={clearTranslations}
          disabled={translations.length === 0}
        >
          Clear Translations
        </button>
      </div>

      <div className="transcript-container">
        <h3>Translations:</h3>
        <div id="translations">
          {translations.length > 0 ? (
            translations.map((translation, index) => (
              <div key={index} style={{ marginBottom: '10px', padding: '5px 0' }}>
                {translation}
              </div>
            ))
          ) : (
            <div style={{ color: '#666' }}>
              {isJoined ? 'Waiting for teacher to speak...' : 'Join a classroom to see translations'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Student; 