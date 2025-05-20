/**
 * AudioMessageHandler
 * 
 * Handles audio streaming messages from the teacher
 * - Follows Single Responsibility Principle
 * - Separates audio processing from other message types
 */

import { WebSocketClient, WebSocketClientManager } from '../WebSocketClientManager';
import { WebSocketMessageHandler } from '../WebSocketMessageRouter';
import { speechTranslationService } from '../TranslationService';

export interface AudioMessage {
  type: 'audio';
  data: string; // base64 encoded audio data
  // Additional fields that might be present
  [key: string]: any;
}

export class AudioMessageHandler implements WebSocketMessageHandler {
  constructor(private clientManager: WebSocketClientManager) {}
  
  /**
   * Check if this handler can process the message type
   */
  public canHandle(type: string): boolean {
    return type === 'audio';
  }
  
  /**
   * Handle audio message
   */
  public async handle(client: WebSocketClient, message: any): Promise<boolean> {
    try {
      const audioMsg = message as AudioMessage;
      const clientState = this.clientManager.getClientState(client);
      
      if (!clientState) {
        console.error('Audio received from unregistered client');
        return false;
      }
      
      // Only teachers can send audio for transcription
      if (clientState.role !== 'teacher') {
        console.log('Ignoring audio from non-teacher role:', clientState.role);
        return false;
      }
      
      // Process teacher audio
      await this.processTeacherAudio(client, audioMsg.data);
      return true;
    } catch (error) {
      console.error('Error handling audio message:', error);
      return false;
    }
  }
  
  /**
   * Process audio from teacher
   */
  private async processTeacherAudio(client: WebSocketClient, audioData: string): Promise<void> {
    try {
      // Initial validation - check if audio data is large enough to be valid
      if (!audioData || audioData.length < 100) {
        console.log('Received invalid or too small audio data (length:', audioData.length, ')');
        return;
      }
      
      const clientState = this.clientManager.getClientState(client);
      if (!clientState) {
        console.error('Client state not found for audio processing');
        return;
      }
      
      console.log('Processing audio data (length:', audioData.length, ') from teacher...');
      
      // Convert base64 to buffer
      let audioBuffer: Buffer;
      try {
        audioBuffer = Buffer.from(audioData, 'base64');
      } catch (error) {
        console.error('Error decoding audio data:', error);
        return;
      }
      
      // Check if the audio buffer is valid
      if (!audioBuffer || audioBuffer.length < 50) {
        console.error('Decoded audio buffer too small:', audioBuffer?.length || 0);
        return;
      }
      
      // Get teacher language
      const teacherLanguage = clientState.language || 'en-US';
      
      // Process the audio for student languages
      // Get all active students and their unique languages
      const students = this.clientManager.getClientsByRole('student');
      
      if (students.length === 0) {
        console.log('No students connected, skipping audio processing');
        return;
      }
      
      // Get unique languages needed for translation
      const studentLanguagesSet = new Set<string>();
      students.forEach(s => {
        if (s.language) {
          studentLanguagesSet.add(s.language);
        }
      });
      const targetLanguages = Array.from(studentLanguagesSet);
      
      console.log(`Processing audio for ${targetLanguages.length} languages:`, targetLanguages);
      
      // Get preferred TTS service from teacher settings
      let preferredTtsService = clientState.settings?.ttsServiceType || 'openai';
      console.log(`Teacher's preferred TTS service: ${preferredTtsService}`);
      
      // Override with openai for best quality
      const ttsServiceToUse = 'openai';
      
      // Process audio streaming
      await this.processAudioForAllLanguages(
        client,
        audioBuffer,
        teacherLanguage,
        targetLanguages,
        ttsServiceToUse
      );
    } catch (error) {
      console.error('Error processing teacher audio:', error);
    }
  }
  
  /**
   * Process audio for all required languages
   */
  private async processAudioForAllLanguages(
    teacherClient: WebSocketClient,
    audioBuffer: Buffer,
    sourceLanguage: string,
    targetLanguages: string[],
    ttsServiceType: string
  ): Promise<void> {
    try {
      // First, get the transcription from the audio
      let transcriptionText = '';
      try {
        // Use translateSpeech but with source and target language the same
        // This will effectively just do transcription
        const transcriptionResult = await speechTranslationService.translateSpeech(
          audioBuffer,
          sourceLanguage,
          sourceLanguage, // Same as source language to skip translation
          '', // No pre-transcribed text
          {}  // No special options
        );
        transcriptionText = transcriptionResult.originalText;
      } catch (error) {
        console.error('Error transcribing audio:', error);
        return;
      }
      
      // If transcription is empty, no need to continue
      if (!transcriptionText || transcriptionText.trim().length === 0) {
        console.log('No transcription found in audio');
        return;
      }
      
      // Send transcription back to teacher
      this.sendTranscriptionToTeacher(teacherClient, transcriptionText, sourceLanguage);
      
      // Process for each target language
      for (const targetLanguage of targetLanguages) {
        // Skip if target language is the same as source (no translation needed)
        if (targetLanguage === sourceLanguage) {
          // We could still generate audio in the same language if needed
          continue;
        }
        
        try {
          // Translate and generate audio
          const result = await speechTranslationService.translateSpeech(
            audioBuffer,
            sourceLanguage,
            targetLanguage,
            transcriptionText, // Use the transcribed text
            { ttsServiceType }
          );
          
          // Get students with this language
          const languageStudents = this.clientManager.getClientsByLanguage(targetLanguage);
          
          // Send translation to all relevant students
          for (const student of languageStudents) {
            this.sendTranslationToStudent(
              student.connection,
              result,
              sourceLanguage,
              targetLanguage,
              ttsServiceType
            );
          }
        } catch (error) {
          console.error(`Error processing translation to ${targetLanguage}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in processAudioForAllLanguages:', error);
    }
  }
  
  /**
   * Send transcription back to teacher
   */
  private sendTranscriptionToTeacher(
    client: WebSocketClient,
    text: string,
    languageCode: string
  ): void {
    try {
      const message = {
        type: 'transcription_result',
        text,
        languageCode,
        timestamp: Date.now()
      };
      
      client.send(JSON.stringify(message));
      console.log(`Sent transcription back to teacher: "${text}"`);
    } catch (error) {
      console.error('Error sending transcription to teacher:', error);
    }
  }
  
  /**
   * Send translation to student
   */
  private sendTranslationToStudent(
    studentClient: WebSocketClient,
    translationResult: {
      originalText: string;
      translatedText: string;
      audioBuffer: Buffer;
    },
    sourceLanguage: string,
    targetLanguage: string,
    ttsServiceType: string
  ): void {
    try {
      // Create translation message base
      const message: any = {
        type: 'translation',
        text: translationResult.translatedText,
        originalText: translationResult.originalText,
        sourceLanguage,
        targetLanguage,
        ttsServiceType,
        timestamp: Date.now()
      };
      
      // Add audio data
      const audioBuffer = translationResult.audioBuffer;
      
      if (audioBuffer && audioBuffer.length > 0) {
        try {
          // Check if this is a browser speech marker
          const bufferString = audioBuffer.toString('utf8');
          
          if (bufferString.startsWith('{"type":"browser-speech"')) {
            message.useClientSpeech = true;
            try {
              message.speechParams = JSON.parse(bufferString);
            } catch (jsonError) {
              console.error('Error parsing speech params:', jsonError);
              message.speechParams = {
                type: 'browser-speech',
                text: translationResult.translatedText,
                languageCode: targetLanguage,
                autoPlay: true
              };
            }
          } else {
            // Real audio data
            message.audioData = audioBuffer.toString('base64');
            message.useClientSpeech = false;
          }
        } catch (error) {
          console.error('Error processing audio data:', error);
          message.error = 'Audio processing failed';
        }
      }
      
      // Send message to student
      studentClient.send(JSON.stringify(message));
      console.log(`Sent translation to student (${targetLanguage}): "${translationResult.translatedText}"`);
    } catch (error) {
      console.error(`Error sending translation to student (${targetLanguage}):`, error);
    }
  }
}