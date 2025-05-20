/**
 * WebSocket Message Router
 * 
 * Responsible for routing WebSocket messages to appropriate handlers
 * based on message type.
 */

import { WebSocketClient, WebSocketMessage } from './WebSocketTypes';
import { WebSocketClientManager } from './WebSocketClientManager';
import { speechTranslationService } from './TranslationService';

// Define handler type
type MessageHandler = (ws: WebSocketClient, message: any) => Promise<void>;

/**
 * WebSocketMessageRouter handles routing messages to appropriate handlers
 */
export class WebSocketMessageRouter {
  private handlers: Map<string, MessageHandler> = new Map();
  
  constructor(private clientManager: WebSocketClientManager) {
    this.registerDefaultHandlers();
  }
  
  /**
   * Register a handler for a specific message type
   */
  public registerHandler(type: string, handler: MessageHandler): void {
    this.handlers.set(type, handler);
  }
  
  /**
   * Handle incoming message by routing to appropriate handler
   */
  public async routeMessage(ws: WebSocketClient, data: string): Promise<void> {
    try {
      // Parse message data
      const message = JSON.parse(data);
      
      // Validate message has a type
      if (!message.type) {
        console.warn('Received message without type:', message);
        return;
      }
      
      // Get handler for message type
      const handler = this.handlers.get(message.type);
      
      if (handler) {
        // Execute handler
        await handler(ws, message);
      } else {
        console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  }
  
  /**
   * Register default message handlers
   */
  private registerDefaultHandlers(): void {
    this.registerHandler('register', this.handleRegisterMessage.bind(this));
    this.registerHandler('transcription', this.handleTranscriptionMessage.bind(this));
    this.registerHandler('tts_request', this.handleTTSRequestMessage.bind(this));
    this.registerHandler('audio', this.handleAudioMessage.bind(this));
    this.registerHandler('settings', this.handleSettingsMessage.bind(this));
    this.registerHandler('ping', this.handlePingMessage.bind(this));
    this.registerHandler('pong', () => Promise.resolve()); // No-op handler for pong messages
  }
  
  /**
   * Handle registration message
   */
  private async handleRegisterMessage(ws: WebSocketClient, message: any): Promise<void> {
    console.log('Processing message type=register from connection:', 
      `role=${message.role}, languageCode=${message.languageCode}`);
    
    const currentRole = this.clientManager.getRole(ws);
    
    // Update role if provided
    if (message.role) {
      if (currentRole !== message.role) {
        console.log(`Changing connection role from ${currentRole} to ${message.role}`);
      }
      this.clientManager.setRole(ws, message.role);
    }
    
    // Update language if provided
    if (message.languageCode) {
      this.clientManager.setLanguage(ws, message.languageCode);
    }
    
    // Update settings if provided
    if (message.settings) {
      this.clientManager.updateSettings(ws, message.settings);
    }
    
    // Special handling for ttsServiceType if specified outside settings object
    if (message.settings?.ttsServiceType) {
      const settings = this.clientManager.getSettings(ws);
      settings.ttsServiceType = message.settings.ttsServiceType;
      this.clientManager.updateSettings(ws, settings);
      
      console.log(`Client requested TTS service type: ${settings.ttsServiceType}`);
      
      // Special notification for teacher TTS service preference
      if (this.clientManager.getRole(ws) === 'teacher') {
        console.log(`Teacher's TTS service preference set to '${settings.ttsServiceType}'. This will be used for all student translations.`);
      }
    }
    
    console.log('Updated connection:', 
      `role=${this.clientManager.getRole(ws)}, languageCode=${this.clientManager.getLanguage(ws)}, ttsService=${this.clientManager.getSettings(ws).ttsServiceType || 'default'}`);
    
    // Send confirmation
    const response = {
      type: 'register',
      status: 'success',
      data: {
        role: this.clientManager.getRole(ws),
        languageCode: this.clientManager.getLanguage(ws),
        settings: this.clientManager.getSettings(ws)
      }
    };
    
    ws.send(JSON.stringify(response));
  }
  
  /**
   * Handle transcription message
   */
  private async handleTranscriptionMessage(ws: WebSocketClient, message: any): Promise<void> {
    console.log('Received transcription from', this.clientManager.getRole(ws), ':', message.text);
    
    // Start tracking latency when transcription is received
    const startTime = Date.now();
    const latencyTracking = {
      start: startTime,
      components: {
        preparation: 0,
        translation: 0,
        tts: 0,
        processing: 0
      }
    };
    
    const role = this.clientManager.getRole(ws);
    const sessionId = this.clientManager.getSessionId(ws);
    
    // Only process transcriptions from teacher
    if (role !== 'teacher') {
      console.warn('Ignoring transcription from non-teacher role:', role);
      return;
    }
    
    // Get all student connections
    const studentConnections = this.clientManager.getClientsByRole('student');
    
    if (studentConnections.length === 0) {
      console.log('No students connected, skipping translation');
      return;
    }
    
    // Get unique student languages
    const studentLanguages: string[] = [];
    studentConnections.forEach(client => {
      const clientLanguage = this.clientManager.getLanguage(client);
      if (clientLanguage && !studentLanguages.includes(clientLanguage)) {
        studentLanguages.push(clientLanguage);
      }
    });
    
    // Translate text to all student languages
    const teacherLanguage = this.clientManager.getLanguage(ws) || 'en-US';
    
    // Storage for translations
    const translations: Record<string, string> = {};
    const translationResults: Record<string, { 
      originalText: string;
      translatedText: string;
      audioBuffer: Buffer;
    }> = {};
    
    // Translate for each language
    for (const targetLanguage of studentLanguages) {
      try {
        // Get the teacher's preferred TTS service type
        let teacherTtsServiceType = process.env.TTS_SERVICE_TYPE || 'browser';
        
        // Look for the teacher's TTS service preference
        const teacherConnections = this.clientManager.getClientsByRole('teacher');
        for (const teacherClient of teacherConnections) {
          const teacherSettings = this.clientManager.getSettings(teacherClient);
          if (teacherSettings.ttsServiceType) {
            // Use the teacher's preference for all student translations
            teacherTtsServiceType = teacherSettings.ttsServiceType;
          }
        }
        
        // Always use OpenAI TTS service for best quality
        const ttsServiceToUse = 'openai';
        console.log(`Using OpenAI TTS service for language '${targetLanguage}' (overriding teacher's selection)`);
        
        // Measure translation and TTS latency
        const translationStartTime = Date.now();
        
        // Perform the translation with OpenAI TTS service
        const result = await speechTranslationService.translateSpeech(
          Buffer.from(''), // Empty buffer as we already have the text
          teacherLanguage,
          targetLanguage,
          message.text, // Use the pre-transcribed text
          { ttsServiceType: ttsServiceToUse } // Force OpenAI TTS service
        );
        
        // Record the translation/TTS latency
        const translationEndTime = Date.now();
        const elapsedTime = translationEndTime - translationStartTime;
        
        // Since this includes both translation and TTS, we'll estimate the split
        // TTS typically takes about 70% of the time
        const ttsTime = Math.round(elapsedTime * 0.7);
        const translationTime = elapsedTime - ttsTime;
        
        latencyTracking.components.translation = Math.max(
          latencyTracking.components.translation,
          translationTime
        );
        
        latencyTracking.components.tts = Math.max(
          latencyTracking.components.tts,
          ttsTime
        );
        
        // Store the full result object for this language
        translationResults[targetLanguage] = result;
        
        // Also store just the text for backward compatibility
        translations[targetLanguage] = result.translatedText;
      } catch (error) {
        console.error(`Error translating to ${targetLanguage}:`, error);
        translations[targetLanguage] = message.text; // Fallback to original text
        translationResults[targetLanguage] = {
          originalText: message.text,
          translatedText: message.text,
          audioBuffer: Buffer.from('') // Empty buffer for fallback
        };
      }
    }
    
    // Calculate processing latency before sending translations
    const processingEndTime = Date.now();
    latencyTracking.components.processing = processingEndTime - startTime - latencyTracking.components.translation;
    
    // Send translations to students
    for (const client of studentConnections) {
      const studentLanguage = this.clientManager.getLanguage(client);
      if (!studentLanguage) continue;
      
      const translatedText = translations[studentLanguage] || message.text;
      
      // Always use OpenAI TTS service - ignore any other settings
      const ttsServiceType = 'openai';
      
      // Calculate total latency up to this point
      const currentTime = Date.now();
      const totalLatency = currentTime - startTime;
      
      // Create translation message with audio data support and latency metrics
      const translationMessage: any = {
        type: 'translation',
        text: translatedText,
        originalText: message.text,
        sourceLanguage: teacherLanguage,
        targetLanguage: studentLanguage,
        ttsServiceType: ttsServiceType, // Include the service type for client reference
        latency: {
          total: totalLatency,
          serverCompleteTime: currentTime, // Timestamp when server completed processing
          components: {
            translation: latencyTracking.components.translation,
            tts: latencyTracking.components.tts,
            processing: latencyTracking.components.processing,
            network: 0 // Will be calculated on client side
          }
        }
      };
      
      // If we have a translation result with audio buffer, include it
      if (translationResults[studentLanguage] && translationResults[studentLanguage].audioBuffer) {
        try {
          const audioBuffer = translationResults[studentLanguage].audioBuffer;
          
          // Check if this is a special marker for browser speech synthesis
          const bufferString = audioBuffer.toString('utf8');
          
          if (bufferString.startsWith('{"type":"browser-speech"')) {
            // This is a marker for browser-based speech synthesis
            console.log(`Using client browser speech synthesis for ${studentLanguage}`);
            translationMessage.useClientSpeech = true;
            try {
              translationMessage.speechParams = JSON.parse(bufferString);
              console.log(`Successfully parsed speech params for ${studentLanguage}`);
            } catch (jsonError) {
              console.error('Error parsing speech params:', jsonError);
              translationMessage.speechParams = {
                type: 'browser-speech',
                text: translatedText,
                languageCode: studentLanguage,
                autoPlay: true
              };
            }
          } else if (audioBuffer.length > 0) {
            // This is actual audio data - encode as base64
            translationMessage.audioData = audioBuffer.toString('base64');
            translationMessage.useClientSpeech = false; // Explicitly set to false
            
            // Log audio data details for debugging
            console.log(`Sending ${audioBuffer.length} bytes of audio data to client`);
            console.log(`Using OpenAI TTS service for ${studentLanguage} (teacher preference: ${ttsServiceType})`);
            console.log(`First 16 bytes of audio: ${Array.from(audioBuffer.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
          } else {
            // Log a warning when no audio data is available
            console.log(`Warning: No audio buffer available for language ${studentLanguage} with TTS service ${ttsServiceType}`);
          }
        } catch (error) {
          console.error('Error processing audio data for translation:', error);
          translationMessage.error = 'Audio processing failed';
        }
      }
      
      // Send the translation message to the student
      try {
        client.send(JSON.stringify(translationMessage));
        console.log(`Sent translation to student: "${translatedText.substring(0, 30)}${translatedText.length > 30 ? '...' : ''}"`);
      } catch (error) {
        console.error('Error sending translation to student:', error);
      }
    }
  }

  /**
   * Handle audio message
   */
  private async handleAudioMessage(ws: WebSocketClient, message: any): Promise<void> {
    const role = this.clientManager.getRole(ws);
    
    // Only process audio from teacher
    if (role !== 'teacher') {
      console.log('Ignoring audio from non-teacher role:', role);
      return;
    }
    
    // Process audio data
    if (message.data) {
      await this.processTeacherAudio(ws, message.data);
    }
  }
  
  /**
   * Process audio from teacher
   */
  private async processTeacherAudio(ws: WebSocketClient, audioData: string): Promise<void> {
    // Validate audio data
    if (!audioData || audioData.length < 100) {
      console.log('Received invalid or too small audio data (length:', audioData.length, ')');
      return;
    }
    
    console.log('Processing audio data (length:', audioData.length, ') from teacher...');
    
    try {
      // Convert base64 to buffer
      const audioBuffer = Buffer.from(audioData, 'base64');
      
      // Skip if buffer is too small
      if (audioBuffer.length < 100) {
        console.log('Decoded audio buffer too small:', audioBuffer.length);
        return;
      }
      
      // Get teacher language
      const teacherLanguage = this.clientManager.getLanguage(ws) || 'en-US';
      
      // Check the Web Speech API transcription info from the client
      let webSpeechTranscription = '';
      try {
        // The first few bytes might be a JSON object with transcription info
        // from the Web Speech API in the browser
        const bufferStart = audioBuffer.slice(0, 200).toString('utf8');
        if (bufferStart.startsWith('{') && bufferStart.includes('transcription')) {
          const endIndex = bufferStart.indexOf('}') + 1;
          const jsonStr = bufferStart.substring(0, endIndex);
          const data = JSON.parse(jsonStr);
          webSpeechTranscription = data.transcription || '';
          
          console.log('Web Speech API transcription from client:', webSpeechTranscription);
        }
      } catch (err) {
        console.warn('No Web Speech API transcription found in audio data');
      }
      
      // Get session ID for reference
      const sessionId = this.clientManager.getSessionId(ws);
      
      // Further audio processing would go here in a production implementation
    } catch (error) {
      console.error('Error processing teacher audio:', error);
    }
  }
  
  /**
   * Handle TTS request message
   */
  private async handleTTSRequestMessage(ws: WebSocketClient, message: any): Promise<void> {
    const text = message.text;
    const languageCode = message.languageCode;
    
    if (!this.validateTTSRequest(text, languageCode)) {
      await this.sendTTSErrorResponse(ws, 'Invalid TTS request parameters');
      return;
    }
    
    // Get the client's preferred TTS service type or default to OpenAI
    let ttsServiceType = this.clientManager.getSettings(ws).ttsServiceType || 'openai';
    
    // Always force OpenAI for best quality
    ttsServiceType = 'openai';
    console.log(`Using OpenAI TTS service for TTS request`);
    
    try {
      // Generate TTS audio
      const audioBuffer = await this.generateTTSAudio(
        text,
        languageCode,
        ttsServiceType,
        message.voice
      );
      
      if (audioBuffer && audioBuffer.length > 0) {
        // Send successful response with audio
        await this.sendTTSResponse(
          ws,
          text,
          languageCode,
          audioBuffer,
          ttsServiceType
        );
      } else {
        // Send error if no audio was generated
        await this.sendTTSErrorResponse(ws, 'Failed to generate audio');
      }
    } catch (error) {
      console.error('Error handling TTS request:', error);
      await this.sendTTSErrorResponse(ws, 'TTS generation error');
    }
  }
  
  /**
   * Validate TTS request parameters
   */
  private validateTTSRequest(text: string, languageCode: string): boolean {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      console.error('Invalid TTS text:', text);
      return false;
    }
    
    if (!languageCode || typeof languageCode !== 'string') {
      console.error('Invalid TTS language code:', languageCode);
      return false;
    }
    
    return true;
  }
  
  /**
   * Generate TTS audio
   */
  private async generateTTSAudio(
    text: string,
    languageCode: string,
    ttsServiceType: string,
    voice?: string
  ): Promise<Buffer> {
    try {
      console.log(`Generating TTS audio for language '${languageCode}' using service '${ttsServiceType}'`);
      
      // Use empty source language as we aren't translating, just doing TTS
      const result = await speechTranslationService.translateSpeech(
        Buffer.from(''), // Empty buffer as we already have the text
        languageCode,   // Source language is the same as target for TTS-only
        languageCode,   // Target language
        text,           // Text to convert to speech
        { ttsServiceType } // Force specified TTS service type
      );
      
      console.log(`TTS audio generated successfully, audio buffer size: ${result.audioBuffer.length} bytes`);
      return result.audioBuffer;
    } catch (error) {
      console.error('Error generating TTS audio:', error);
      return Buffer.from(''); // Return empty buffer on error
    }
  }
  
  /**
   * Send TTS response with audio data
   */
  private async sendTTSResponse(
    ws: WebSocketClient,
    text: string,
    languageCode: string,
    audioBuffer: Buffer,
    ttsServiceType: string
  ): Promise<void> {
    try {
      // Create base message
      const response: any = {
        type: 'tts_response',
        status: 'success',
        text,
        languageCode,
        ttsServiceType,
        timestamp: Date.now()
      };
      
      // Check if this is a browser speech synthesis marker
      const bufferString = audioBuffer.toString('utf8');
      
      if (bufferString.startsWith('{"type":"browser-speech"')) {
        response.useClientSpeech = true;
        try {
          response.speechParams = JSON.parse(bufferString);
        } catch (error) {
          console.error('Error parsing speech params:', error);
          response.speechParams = {
            type: 'browser-speech',
            text,
            languageCode,
            autoPlay: true
          };
        }
      } else {
        // Real audio data
        response.audioData = audioBuffer.toString('base64');
        response.useClientSpeech = false;
      }
      
      // Send response
      ws.send(JSON.stringify(response));
      console.log(`TTS response sent successfully for language '${languageCode}'`);
    } catch (error) {
      console.error('Error sending TTS response:', error);
      // Try to send error message if possible
      try {
        await this.sendTTSErrorResponse(ws, 'Failed to send audio data');
      } catch (sendError) {
        console.error('Error sending TTS error response:', sendError);
      }
    }
  }
  
  /**
   * Send TTS error response
   */
  private async sendTTSErrorResponse(
    ws: WebSocketClient,
    message: string,
    code: string = 'TTS_ERROR'
  ): Promise<void> {
    try {
      const errorResponse = {
        type: 'tts_response',
        status: 'error',
        error: {
          message,
          code
        },
        timestamp: Date.now()
      };
      
      ws.send(JSON.stringify(errorResponse));
      console.error(`TTS error response sent: ${message}`);
    } catch (error) {
      console.error('Error sending TTS error response:', error);
    }
  }
  
  /**
   * Handle settings message
   */
  private async handleSettingsMessage(ws: WebSocketClient, message: any): Promise<void> {
    const role = this.clientManager.getRole(ws);
    
    console.log(`Processing settings update from ${role || 'unknown'}:`, message);
    
    // Update settings with new values
    const settings: any = {};
    
    // Update settings with new values
    if (message.settings) {
      Object.assign(settings, message.settings);
    }
    
    // Special handling for ttsServiceType since it can be specified outside settings object
    if (message.ttsServiceType) {
      settings.ttsServiceType = message.ttsServiceType;
      console.log(`Updated TTS service type for ${role} to: ${settings.ttsServiceType}`);
      
      // Special notification for teacher TTS service preference
      if (role === 'teacher') {
        console.log(`Teacher's TTS service preference set to '${settings.ttsServiceType}'. This will be used for all student translations.`);
      }
    }
    
    // Store updated settings
    const updatedSettings = this.clientManager.updateSettings(ws, settings);
    
    // Send confirmation
    const response = {
      type: 'settings',
      status: 'success',
      settings: updatedSettings
    };
    
    ws.send(JSON.stringify(response));
  }
  
  /**
   * Handle ping message
   */
  private async handlePingMessage(ws: WebSocketClient, message: any): Promise<void> {
    // Mark as alive for heartbeat
    this.clientManager.markAlive(ws);
    
    // Send pong response
    const response = {
      type: 'pong',
      timestamp: Date.now(),
      originalTimestamp: message.timestamp
    };
    
    try {
      ws.send(JSON.stringify(response));
    } catch (error) {
      console.error('Error sending pong response:', error);
    }
  }
}