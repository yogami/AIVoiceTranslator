import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { TranslationPayload, wsClient } from '@/lib/websocket';

interface Transcript {
  id: number;
  text: string;
  timestamp: string;
}

interface PerformanceMetrics {
  averageLatency: number;
  translationsCount: number;
  startTime: number;
}

interface UseTranslationOptions {
  languageCode: string;
  role: 'teacher' | 'student';
  autoConnect?: boolean;
}

export function useTranslation(options: UseTranslationOptions) {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [currentSpeech, setCurrentSpeech] = useState<string>('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    averageLatency: 0,
    translationsCount: 0,
    startTime: Date.now(),
  });
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [volume, setVolume] = useState(80);
  const [isPaused, setIsPaused] = useState(false);

  // Initialize WebSocket connection
  const {
    status,
    sessionId,
    sendAudio,
    updateLanguage,
    updateRole,
    addEventListener,
    requestTranscripts
  } = useWebSocket({
    role: options.role,
    languageCode: options.languageCode,
    autoConnect: options.autoConnect,
  });
  
  // For teacher role, ensure it's locked as early as possible
  useEffect(() => {
    if (options.role === 'teacher') {
      // Use the WebSocket client imported at the top of the file
      // Set and lock the role - this is a critical step that prevents role switching
      wsClient.setRoleAndLock('teacher');
      console.log('useTranslation: Teacher role locked at hook initialization');
    }
  }, [options.role]);

  // Update language when changed
  useEffect(() => {
    updateLanguage(options.languageCode);
  }, [options.languageCode, updateLanguage]);

  // Handle new translations
  useEffect(() => {
    const handleTranslation = (data: any) => {
      console.log('Translation event received:', data);
      
      if (!data || !data.data) {
        console.error('Invalid translation data structure:', data);
        return;
      }
      
      const { translatedText, audio, timestamp, latency, originalText } = data.data;
      
      // Add detailed logs to help debug
      console.log('Translation data details:', { 
        translatedText, 
        originalText, 
        hasAudio: !!audio,
        timestamp,
        dataType: typeof data,
        translatedTextType: typeof translatedText
      });
      
      // Force update UI regardless of text content for debugging
      let textToDisplay = translatedText;
      
      // Handle different text scenarios
      if (!textToDisplay) {
        console.log('No text in translation, using placeholder');
        textToDisplay = "(No text received)";
      } else if (typeof textToDisplay !== 'string') {
        console.log('Translation text is not a string:', textToDisplay);
        textToDisplay = String(textToDisplay);
      } else {
        textToDisplay = textToDisplay.trim();
        console.log('Setting current speech to:', textToDisplay);
      }
      
      // Always update the UI so we know we're receiving events
      setCurrentSpeech(textToDisplay);
        
      // Create audio URL for playback if we have audio
      if (audio) {
        const audioUrl = `data:audio/mp3;base64,${audio}`;
        setAudioUrl(audioUrl);
        
        // Auto play if student and not paused
        if (options.role === 'student' && !isPaused) {
          playAudio(audioUrl);
        }
      }
      
      // Only add to transcripts and update metrics if we have real content
      if (textToDisplay && textToDisplay !== "(No text received)") {
        // Add to transcripts
        setTranscripts(prev => [
          ...prev,
          {
            id: Date.now(),
            text: textToDisplay,
            timestamp
          }
        ]);
        
        // Update metrics
        setMetrics(prev => {
          const newCount = prev.translationsCount + 1;
          const newAvgLatency = (prev.averageLatency * prev.translationsCount + latency) / newCount;
          
          return {
            averageLatency: newAvgLatency,
            translationsCount: newCount,
            startTime: prev.startTime
          };
        });
      }
    };
    
    const cleanup = addEventListener('translation', handleTranslation);
    
    return cleanup;
  }, [addEventListener, options.role, isPaused]);

  // Load transcripts when session ID is available
  useEffect(() => {
    if (sessionId && options.role === 'student') {
      requestTranscripts(options.languageCode);
    }
  }, [sessionId, options.role, options.languageCode, requestTranscripts]);

  // Handle transcript history
  useEffect(() => {
    const handleTranscriptHistory = (data: { data: Transcript[] }) => {
      setTranscripts(data.data);
    };
    
    const cleanup = addEventListener('transcript_history', handleTranscriptHistory);
    
    return cleanup;
  }, [addEventListener]);

  // Create audio element
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const audio = new Audio();
    audio.volume = volume / 100;
    
    setAudioElement(audio);
    
    return () => {
      audio.pause();
      audio.src = '';
    };
  }, []);

  // Update audio volume when changed
  useEffect(() => {
    if (audioElement) {
      audioElement.volume = volume / 100;
    }
  }, [volume, audioElement]);

  // Send audio data function
  const sendAudioData = useCallback((audioBase64: string) => {
    console.log('useTranslation: Received audio data to send, length:', audioBase64.length);
    return sendAudio(audioBase64);
  }, [sendAudio]);

  // Play audio
  const playAudio = useCallback((url: string) => {
    if (!audioElement) return;
    
    audioElement.src = url;
    audioElement.oncanplaythrough = () => {
      if (!isPaused) {
        audioElement.play()
          .then(() => setIsPlaying(true))
          .catch(err => console.error('Error playing audio:', err));
      }
    };
    
    audioElement.onended = () => {
      setIsPlaying(false);
    };
  }, [audioElement, isPaused]);

  // Pause audio
  const pauseAudio = useCallback(() => {
    if (audioElement) {
      audioElement.pause();
      setIsPlaying(false);
      setIsPaused(true);
    }
  }, [audioElement]);

  // Resume audio
  const resumeAudio = useCallback(() => {
    if (audioElement && audioUrl) {
      setIsPaused(false);
      audioElement.play()
        .then(() => setIsPlaying(true))
        .catch(err => console.error('Error resuming audio:', err));
    }
  }, [audioElement, audioUrl]);

  // Change volume
  const changeVolume = useCallback((newVolume: number) => {
    setVolume(newVolume);
    if (audioElement) {
      audioElement.volume = newVolume / 100;
    }
  }, [audioElement]);

  // Get session duration in seconds
  const getSessionDuration = useCallback(() => {
    return Math.floor((Date.now() - metrics.startTime) / 1000);
  }, [metrics.startTime]);

  // Download transcript
  const downloadTranscript = useCallback(() => {
    if (transcripts.length === 0) return;
    
    const text = transcripts
      .map(t => `[${new Date(t.timestamp).toLocaleTimeString()}] ${t.text}`)
      .join('\n\n');
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript_${options.languageCode}_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
  }, [transcripts, options.languageCode]);

  return {
    status,
    sessionId,
    transcripts,
    currentSpeech,
    audioUrl,
    isPlaying,
    isPaused,
    volume,
    metrics,
    sendAudioData,
    playAudio,
    pauseAudio,
    resumeAudio,
    changeVolume,
    getSessionDuration,
    downloadTranscript
  };
}
