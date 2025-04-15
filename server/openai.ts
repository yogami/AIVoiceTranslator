import fs from 'fs';
import OpenAI from 'openai';
import { storage } from './storage';

// Initialize OpenAI client with API key from environment
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Define response interface for the translation function
interface TranslationResult {
  originalText: string;
  translatedText: string;
  audioBuffer: Buffer;
}

/**
 * Transcribe and translate speech using OpenAI Whisper and GPT models
 * 
 * @param audioBuffer - Buffer containing audio data to transcribe
 * @param sourceLanguage - Language code of the source audio
 * @param targetLanguage - Language code to translate to
 * @param preTranscribedText - (Optional) If you already have the transcribed text, provide it to skip transcription
 * @returns - Object containing original text, translated text and audio buffer
 */
export async function translateSpeech(
  audioBuffer: Buffer, 
  sourceLanguage: string, 
  targetLanguage: string,
  preTranscribedText?: string
): Promise<TranslationResult> {
  console.log(`Processing speech translation from ${sourceLanguage} to ${targetLanguage}`);
  
  let originalText: string;
  
  // If text is already provided, skip transcription step
  if (preTranscribedText) {
    console.log(`Using pre-transcribed text instead of audio: "${preTranscribedText}"`);
    originalText = preTranscribedText;
  } else {
    // Handle empty or too small audio buffer
    if (!audioBuffer || audioBuffer.length < 1000) {
      console.log(`Audio buffer too small for transcription: ${audioBuffer?.length} bytes`);
      return { 
        originalText: '', 
        translatedText: '', 
        audioBuffer: Buffer.from('') 
      };
    }
    
    // Transcribe audio
    console.log(`Transcribing audio buffer of size ${audioBuffer.length}...`);
    
    // Log some info about the audio buffer for debugging
    console.log(`Audio buffer header (hex): ${audioBuffer.slice(0, 32).toString('hex')}`);
    console.log(`Audio buffer has valid WAV header: ${audioBuffer.slice(0, 4).toString() === 'RIFF'}`);
    
    // Save the buffer to a temporary file for easier manipulation
    const tempFilePath = '/home/runner/workspace/temp-audio.wav';
    fs.writeFileSync(tempFilePath, audioBuffer);
    console.log(`Saved audio buffer to temporary file: ${tempFilePath}`);
    
    // Create stream from file
    const audioReadStream = fs.createReadStream(tempFilePath);
    console.log('Sending read stream to OpenAI API');
    
    try {
      // Apply specific parameters to avoid hallucinations
      console.log('Enhancing audio parameters for better transcription results...');
      console.log('MODIFIED: Using new transcription parameters to avoid YouTube-style hallucinations...');
      
      // Transcribe with OpenAI Whisper API
      // Use more optimized parameters for classroom settings
      const transcriptionResponse = await openai.audio.transcriptions.create({
        file: audioReadStream,
        model: 'whisper-1',
        language: sourceLanguage.split('-')[0],  // Use just the language part (e.g., 'en' from 'en-US')
        response_format: 'json',
        temperature: 0.2,  // Slight creativity to help with harder words
        prompt: 'This is classroom speech from a teacher. Transcribe any audible speech accurately. If there is no speech or only background noise, return an empty string.'
      });
      
      // Clean up the temporary file
      try {
        fs.unlinkSync(tempFilePath);
        console.log(`Deleted temporary file: ${tempFilePath}`);
      } catch (err) {
        console.error('Error cleaning up temporary file:', err);
      }
      
      // Log the full response for debugging
      console.log(`Full transcription response: ${JSON.stringify(transcriptionResponse)}`);
      
      // Use the detected text or empty string if not found
      if (transcriptionResponse.text) {
        originalText = transcriptionResponse.text;
        console.log(`Transcription successful: { text: '${originalText}' }`);
        console.log(`📢 DIAGNOSTIC - EXACT TRANSCRIPTION FROM OPENAI: "${originalText}"`);
      } else {
        console.log('Transcription returned no text - Whisper API failed to detect speech');
        originalText = '';
        // Note: The WebSocketServer will handle fallback to Web Speech API if needed
      }
    } catch (error) {
      console.error('Error during transcription:', error);
      
      // Clean up the temporary file in case of error
      try {
        fs.unlinkSync(tempFilePath);
        console.log(`Deleted temporary file after error: ${tempFilePath}`);
      } catch (err) {
        console.error('Error cleaning up temporary file:', err);
      }
      
      throw error;
    }
  }
  
  // Skip empty transcriptions
  if (!originalText) {
    return { 
      originalText: '', 
      translatedText: '', 
      audioBuffer 
    };
  }
  
  // If target language is the same as source language, no translation needed
  if (targetLanguage === sourceLanguage) {
    console.log(`Successfully processed translation to ${targetLanguage}`);
    console.log(`Translation complete: "${originalText}" -> "${originalText}"`);
    
    return { 
      originalText, 
      translatedText: originalText, 
      audioBuffer 
    };
  }
  
  // Translate to target language
  try {
    const prompt = `
      Translate this text from ${getLanguageName(sourceLanguage)} to ${getLanguageName(targetLanguage)}. 
      Maintain the same tone and style. Return only the translation without explanations or notes.
      
      Original text: "${originalText}"
      
      Translation:
    `;
    
    const translation = await openai.chat.completions.create({
      model: 'gpt-4o', // Using the newest OpenAI model for translation
      messages: [
        { role: 'system', content: 'You are a professional translator with expertise in multiple languages.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 500
    });
    
    const translatedText = translation.choices[0].message.content?.trim() || originalText;
    
    console.log(`Successfully processed translation to ${targetLanguage}`);
    console.log(`Translation complete: "${originalText}" -> "${translatedText}"`);
    
    return { 
      originalText, 
      translatedText, 
      audioBuffer 
    };
  } catch (error) {
    console.error(`Error translating to ${targetLanguage}:`, error);
    
    // Return original text as fallback if translation fails
    return { 
      originalText, 
      translatedText: originalText, 
      audioBuffer 
    };
  }
}

// Helper function to get the language name from language code
function getLanguageName(languageCode: string): string {
  const languageMap: {[key: string]: string} = {
    'en-US': 'English',
    'fr-FR': 'French',
    'es-ES': 'Spanish',
    'de-DE': 'German',
    'it-IT': 'Italian',
    'ja-JP': 'Japanese',
    'ko-KR': 'Korean',
    'pt-BR': 'Portuguese',
    'ru-RU': 'Russian',
    'zh-CN': 'Chinese (Simplified)',
    'ar-SA': 'Arabic',
    'hi-IN': 'Hindi',
    'tr-TR': 'Turkish',
    'nl-NL': 'Dutch',
    'pl-PL': 'Polish',
    'sv-SE': 'Swedish',
    'da-DK': 'Danish',
    'fi-FI': 'Finnish',
    'no-NO': 'Norwegian',
    'cs-CZ': 'Czech',
    'hu-HU': 'Hungarian',
    'el-GR': 'Greek',
    'he-IL': 'Hebrew',
    'th-TH': 'Thai',
    'vi-VN': 'Vietnamese',
    'id-ID': 'Indonesian',
    'ms-MY': 'Malay',
    'ro-RO': 'Romanian',
    'uk-UA': 'Ukrainian',
    'bg-BG': 'Bulgarian',
    'hr-HR': 'Croatian',
    'sr-RS': 'Serbian',
    'sk-SK': 'Slovak',
    'sl-SI': 'Slovenian',
    'et-EE': 'Estonian',
    'lv-LV': 'Latvian',
    'lt-LT': 'Lithuanian'
  };
  
  return languageMap[languageCode] || languageCode.split('-')[0];
}