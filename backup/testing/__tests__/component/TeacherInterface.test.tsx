import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import TeacherInterface from '../../client/src/components/TeacherInterface';
import { MockWebSocketService } from '../mocks/webSocketService.mock';
import { MockTranscriptionService } from '../mocks/transcriptionService.mock';

// Mock all required hooks and services
jest.mock('../../client/src/lib/websocket', () => {
  const originalModule = jest.requireActual('../../client/src/lib/websocket');
  return {
    ...originalModule,
    wsClient: MockWebSocketService.getInstance(),
  };
});

// Mock the useWebSpeech hook
jest.mock('../../client/src/hooks/useWebSpeech', () => {
  return {
    useWebSpeech: () => {
      const mockTranscriptionService = new MockTranscriptionService();
      
      return {
        transcriptionService: mockTranscriptionService,
        isListening: false,
        startListening: jest.fn().mockImplementation(() => mockTranscriptionService.start()),
        stopListening: jest.fn().mockImplementation(() => mockTranscriptionService.stop()),
        isSupported: true,
        error: null,
      };
    },
  };
});

// Mock the useTranscripts hook
jest.mock('../../client/src/hooks/useTranscripts', () => {
  return {
    useTranscripts: () => {
      return {
        transcripts: [
          {
            sessionId: 'test-session',
            sourceLanguage: 'en-US',
            targetLanguage: 'en-US',
            originalText: 'Test transcript',
            translatedText: 'Test transcript',
            timestamp: new Date().toISOString(),
            latency: 150
          }
        ],
        currentSpeech: '',
        isTranslating: false
      };
    },
  };
});

describe('TeacherInterface Component', () => {
  let mockWebSocketService: MockWebSocketService;
  
  beforeEach(() => {
    // Reset the mock WebSocket service before each test
    mockWebSocketService = MockWebSocketService.getInstance();
    mockWebSocketService.reset();
    
    // Connect and set role to teacher
    mockWebSocketService.connect();
    mockWebSocketService.setRoleAndLock('teacher');
  });
  
  test('renders teacher interface with all required components', () => {
    // Arrange & Act
    render(<TeacherInterface />);
    
    // Assert
    expect(screen.getByText(/Teacher Dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/Current Speech/i)).toBeInTheDocument();
    expect(screen.getByText(/Transcription History/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start Recording/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Language/i })).toBeInTheDocument();
  });
  
  test('displays "Connecting..." when WebSocket is connecting', () => {
    // Arrange
    mockWebSocketService.disconnect();
    mockWebSocketService.reset();
    
    // Act
    render(<TeacherInterface />);
    
    // Assert
    expect(screen.getByText(/Connecting/i)).toBeInTheDocument();
  });
  
  test('displays error message when connection fails', async () => {
    // Arrange
    mockWebSocketService.disconnect();
    mockWebSocketService.reset();
    mockWebSocketService.setFailNextConnection(true);
    
    // Act
    render(<TeacherInterface />);
    mockWebSocketService.connect().catch(() => {}); // Connect will fail, but we need to handle the promise
    
    // Wait for error message to appear
    await waitFor(() => {
      expect(screen.getByText(/Failed to connect/i)).toBeInTheDocument();
    });
  });
  
  test('updates language when user changes the language selector', () => {
    // Arrange
    render(<TeacherInterface />);
    const languageSelector = screen.getByRole('combobox', { name: /Language/i });
    
    // Act
    fireEvent.change(languageSelector, { target: { value: 'es-ES' } });
    
    // Assert
    // Check the register message was sent with the new language
    const messages = mockWebSocketService.getMessageHistory();
    const registerMessage = messages.find(m => m.type === 'register' && m.payload?.languageCode === 'es-ES');
    expect(registerMessage).toBeTruthy();
  });
  
  test('starts recording when Start Recording button is clicked', async () => {
    // Arrange
    render(<TeacherInterface />);
    const startButton = screen.getByRole('button', { name: /Start Recording/i });
    
    // Act
    fireEvent.click(startButton);
    
    // Assert
    // The button should change to "Stop Recording"
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Stop Recording/i })).toBeInTheDocument();
    });
  });
  
  test('stops recording when Stop Recording button is clicked', async () => {
    // Arrange
    render(<TeacherInterface />);
    let startButton = screen.getByRole('button', { name: /Start Recording/i });
    
    // Start recording first
    fireEvent.click(startButton);
    
    // Wait for button to change
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Stop Recording/i })).toBeInTheDocument();
    });
    
    // Act
    const stopButton = screen.getByRole('button', { name: /Stop Recording/i });
    fireEvent.click(stopButton);
    
    // Assert
    // The button should change back to "Start Recording"
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Start Recording/i })).toBeInTheDocument();
    });
  });
  
  test('displays current speech when speech is detected', async () => {
    // Arrange
    render(<TeacherInterface />);
    
    // Act - simulate incoming current speech message
    mockWebSocketService.simulateCurrentSpeech('This is a test speech');
    
    // Assert
    await waitFor(() => {
      expect(screen.getByText(/This is a test speech/i)).toBeInTheDocument();
    });
  });
  
  test('displays transcription history', () => {
    // Arrange & Act
    render(<TeacherInterface />);
    
    // Assert - check that the test transcript is displayed
    expect(screen.getByText(/Test transcript/i)).toBeInTheDocument();
  });
  
  test('displays reconnecting message when connection is lost', async () => {
    // Arrange
    render(<TeacherInterface />);
    
    // Act - simulate disconnection
    mockWebSocketService.simulateDisconnect();
    
    // Assert
    await waitFor(() => {
      expect(screen.getByText(/Reconnecting/i)).toBeInTheDocument();
    });
  });
  
  test('reconnects automatically when connection is lost', async () => {
    // Arrange
    render(<TeacherInterface />);
    
    // Act - simulate disconnection and reconnection
    mockWebSocketService.simulateDisconnect();
    
    // Wait for reconnecting message
    await waitFor(() => {
      expect(screen.getByText(/Reconnecting/i)).toBeInTheDocument();
    });
    
    // Simulate successful reconnection
    mockWebSocketService.simulateReconnect();
    
    // Assert
    await waitFor(() => {
      // Reconnecting message should be gone
      expect(screen.queryByText(/Reconnecting/i)).not.toBeInTheDocument();
    });
  });
});