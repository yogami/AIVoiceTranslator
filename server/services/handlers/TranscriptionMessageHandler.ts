/**
 * TranscriptionMessageHandler
 * 
 * Handles teacher transcription messages and coordinates translation to student languages
 * - Follows Single Responsibility Principle
 * - Separates transcription handling from other message types
 */

import { WebSocketClient, WebSocketClientManager } from '../WebSocketClientManager';
import { WebSocketMessageHandler } from '../WebSocketMessageRouter';
import { speechTranslationService } from '../TranslationService';

export interface TranscriptionMessage {
  type: 'transcription';
  text: string;
  // Additional fields that might be present
  [key: string]: any;
}

export class TranscriptionMessageHandler implements WebSocketMessageHandler {
  constructor(private clientManager: WebSocketClientManager) {}
  
  /**
   * Check if this handler can process the message type
   */
  public canHandle(type: string): boolean {
    return type === 'transcription';
  }
  
  /**
   * Handle transcription message (from teacher)
   */
  public async handle(client: WebSocketClient, message: any): Promise<boolean> {
    const transcriptionMsg = message as TranscriptionMessage;
    const clientState = this.clientManager.getClientState(client);
    
    // Validate sender is a teacher
    if (!clientState || clientState.role !== 'teacher') {
      console.warn('Ignoring transcription from non-teacher role:', clientState?.role);
      return false;
    }
    
    // Get teacher's language
    const teacherLanguage = clientState.language || 'en-US';
    console.log('Received transcription from teacher:', transcriptionMsg.text);
    
    // Start tracking latency
    const startTime = Date.now();
    
    // Get all student connections and their languages
    const students = this.clientManager.getClientsByRole('student');
    if (students.length === 0) {
      console.log('No students connected, skipping translation');
      return true;
    }
    
    // Get unique languages needed for translation
    const studentLanguagesSet = new Set<string>();
    students.forEach(s => {
      if (s.language) {
        studentLanguagesSet.add(s.language);
      }
    });
    const uniqueLanguages = Array.from(studentLanguagesSet);
    
    // Track performance metrics
    const latencyTracking = {
      start: startTime,
      components: {
        preparation: Date.now() - startTime,
        translation: 0,
        tts: 0,
        processing: 0
      }
    };
    
    // Perform translations for each unique language
    const translationResults: Record<string, {
      originalText: string;
      translatedText: string;
      audioBuffer: Buffer;
    }> = {};
    
    // Get teacher's TTS service preference
    const teacherSettings = clientState.settings || {};
    const preferredTtsService = teacherSettings.ttsServiceType || 'openai';
    
    // Always use OpenAI TTS for best quality
    const ttsServiceToUse = 'openai';
    
    for (const targetLanguage of uniqueLanguages) {
      try {
        // Measure translation start time
        const translationStartTime = Date.now();
        
        // Perform translation with TTS
        const result = await speechTranslationService.translateSpeech(
          Buffer.from(''), // Empty buffer as we already have the text
          teacherLanguage,
          targetLanguage,
          transcriptionMsg.text, // Use the provided text
          { ttsServiceType: ttsServiceToUse }
        );
        
        // Record translation time
        const translationEndTime = Date.now();
        const elapsedTime = translationEndTime - translationStartTime;
        
        // Roughly estimate TTS vs translation time (TTS is typically 70% of total)
        const ttsTime = Math.round(elapsedTime * 0.7);
        const translationTime = elapsedTime - ttsTime;
        
        // Update latency tracking with max values (in case of parallel processing)
        latencyTracking.components.translation = Math.max(
          latencyTracking.components.translation,
          translationTime
        );
        
        latencyTracking.components.tts = Math.max(
          latencyTracking.components.tts,
          ttsTime
        );
        
        // Store the result
        translationResults[targetLanguage] = result;
      } catch (error) {
        console.error(`Error translating to ${targetLanguage}:`, error);
        
        // Create a fallback empty result
        translationResults[targetLanguage] = {
          originalText: transcriptionMsg.text,
          translatedText: transcriptionMsg.text, // Fallback to original
          audioBuffer: Buffer.from('') // Empty buffer
        };
      }
    }
    
    // Calculate processing latency
    const processingEndTime = Date.now();
    latencyTracking.components.processing = processingEndTime - startTime - 
      latencyTracking.components.translation - latencyTracking.components.tts;
    
    // Send translations to relevant students
    for (const student of students) {
      const studentLanguage = student.language;
      if (!studentLanguage || !translationResults[studentLanguage]) continue;
      
      const result = translationResults[studentLanguage];
      
      // Calculate total latency so far
      const currentTime = Date.now();
      const totalLatency = currentTime - startTime;
      
      // Create translation message
      const translationMessage: any = {
        type: 'translation',
        text: result.translatedText,
        originalText: transcriptionMsg.text,
        sourceLanguage: teacherLanguage,
        targetLanguage: studentLanguage,
        ttsServiceType: ttsServiceToUse,
        latency: {
          total: totalLatency,
          serverCompleteTime: currentTime,
          components: {
            translation: latencyTracking.components.translation,
            tts: latencyTracking.components.tts,
            processing: latencyTracking.components.processing,
            network: 0 // Will be calculated on client side
          }
        }
      };
      
      // Add audio data if available
      if (result.audioBuffer.length > 0) {
        const audioBuffer = result.audioBuffer;
        
        try {
          // Check if this is a browser speech synthesis marker
          const bufferString = audioBuffer.toString('utf8');
          
          if (bufferString.startsWith('{"type":"browser-speech"')) {
            // Client browser speech synthesis
            translationMessage.useClientSpeech = true;
            try {
              translationMessage.speechParams = JSON.parse(bufferString);
            } catch (jsonError) {
              console.error('Error parsing speech params:', jsonError);
              translationMessage.speechParams = {
                type: 'browser-speech',
                text: result.translatedText,
                languageCode: studentLanguage,
                autoPlay: true
              };
            }
          } else {
            // Real audio data
            translationMessage.audioData = audioBuffer.toString('base64');
            translationMessage.useClientSpeech = false;
          }
        } catch (error) {
          console.error('Error processing audio data:', error);
          translationMessage.error = 'Audio processing failed';
        }
      }
      
      // Send the translation to this student
      try {
        student.connection.send(JSON.stringify(translationMessage));
      } catch (error) {
        console.error('Error sending translation to student:', error);
      }
    }
    
    // Log summary of translations
    console.log(`Sent translations to ${students.length} students in ${uniqueLanguages.length} languages`);
    console.log(`Total latency: ${Date.now() - startTime}ms`);
    
    return true;
  }
}