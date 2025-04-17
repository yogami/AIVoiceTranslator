import fs from 'fs';
import OpenAI from 'openai';
import { storage } from './storage';

// Log API key status (masked for security)
console.log(`OpenAI API key status: ${process.env.OPENAI_API_KEY ? 'Present' : 'Missing'}`);
if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY is missing or empty. This might cause API failures.');
}

// Initialize OpenAI client with API key from environment
// Add fallback to avoid crashing the server if key is missing
let openai: OpenAI;
try {
  openai = new OpenAI({ 
    apiKey: process.env.OPENAI_API_KEY || 'sk-placeholder-for-initialization-only' 
  });
  console.log('OpenAI client initialized successfully');
} catch (error) {
  console.error('Error initializing OpenAI client:', error);
  // Create a placeholder client that will throw proper errors when methods are called
  openai = new OpenAI({ apiKey: 'sk-placeholder-for-initialization-only' });
}

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
  
  // DEVELOPMENT MODE: Check if API key is missing
  if (!process.env.OPENAI_API_KEY) {
    console.log('DEV MODE: Using synthetic translation data due to missing API key');
    
    // Get the transcription from WebSpeech API if available
    const transcribedText = preTranscribedText || 'This is a development mode transcription.';
    
    // Generate synthetic translation based on the target language
    let translatedText = transcribedText;
    if (targetLanguage.startsWith('es')) {
      // Spanish
      translatedText = 'Esto es una traducción en modo de desarrollo.';
    } else if (targetLanguage.startsWith('fr')) {
      // French
      translatedText = 'Ceci est une traduction en mode développement.';
    } else if (targetLanguage.startsWith('de')) {
      // German
      translatedText = 'Dies ist eine Übersetzung im Entwicklungsmodus.';
    }
    
    // Create a fake audio buffer
    // In a real application, this would be the audio from text-to-speech
    // For development, we're using a minimal PCM WAV header + some silence
    const wavHeader = Buffer.from([
      0x52, 0x49, 0x46, 0x46, // "RIFF"
      0x24, 0x00, 0x00, 0x00, // ChunkSize (36 bytes + data size)
      0x57, 0x41, 0x56, 0x45, // "WAVE"
      0x66, 0x6d, 0x74, 0x20, // "fmt "
      0x10, 0x00, 0x00, 0x00, // Subchunk1Size (16 bytes)
      0x01, 0x00,             // AudioFormat (1 = PCM)
      0x01, 0x00,             // NumChannels (1 = mono)
      0x44, 0xac, 0x00, 0x00, // SampleRate (44100 Hz)
      0x88, 0x58, 0x01, 0x00, // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
      0x02, 0x00,             // BlockAlign (NumChannels * BitsPerSample/8)
      0x10, 0x00,             // BitsPerSample (16 bits)
      0x64, 0x61, 0x74, 0x61, // "data"
      0x00, 0x00, 0x00, 0x00  // Subchunk2Size (data size)
    ]);
    
    // Add some silence (1 second)
    const sampleCount = 44100;
    const dataSize = sampleCount * 2; // 16-bit samples
    const silenceData = Buffer.alloc(dataSize);
    
    // Update the data chunk size in the header
    wavHeader.writeUInt32LE(dataSize, 40);
    // Update the overall file size in the header
    wavHeader.writeUInt32LE(36 + dataSize, 4);
    
    // Combine header and data
    const audioBuffer = Buffer.concat([wavHeader, silenceData]);
    
    console.log(`DEV MODE: Returning synthetic translation: "${translatedText}"`);
    
    return {
      originalText: transcribedText,
      translatedText: translatedText,
      audioBuffer: audioBuffer
    };
  }
  
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
        temperature: 0.2  // Slight creativity to help with harder words
        // Removed prompt to prevent prompt leakage
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
        
        // Filter out cases where the model is returning the prompt or instructions
        // List of suspicious phrases that indicate prompt leakage rather than actual speech
        const suspiciousPhrases = [
          "If there is no speech or only background noise, return an empty string",
          "This is classroom speech from a teacher",
          "Transcribe any audible speech accurately",
          "return an empty string"
        ];
        
        const isPotentialPromptLeak = suspiciousPhrases.some(phrase => 
          originalText.includes(phrase)
        );
        
        if (isPotentialPromptLeak) {
          console.log('⚠️ DETECTED PROMPT LEAKAGE: The transcription appears to contain prompt instructions');
          console.log('Treating this as an empty transcription and triggering fallback mechanism');
          originalText = '';
        }
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
      model: 'gpt-4o', // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
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