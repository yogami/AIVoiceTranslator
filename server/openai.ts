import OpenAI from "openai";
import * as fs from 'fs';
import { writeFileSync, unlinkSync, createReadStream } from 'fs';
import path from 'path';

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
const apiKey = process.env.OPENAI_API_KEY || "";

// Initialize OpenAI client
const openai = new OpenAI({ apiKey });

/**
 * Handles direct speech-to-speech translation using OpenAI's API
 * Process: Transcribe audio → Translate text → Convert to speech
 */
export async function translateSpeech(
  audioBuffer: Buffer,
  sourceLanguage: string,
  targetLanguage: string
) {
  try {
    console.log(`Processing speech translation from ${sourceLanguage} to ${targetLanguage}`);
    
    // Step 1: Transcribe audio to text
    const transcribedText = await transcribeAudio(audioBuffer);
    
    // If transcription is empty (due to short audio or other issues), return empty result
    if (!transcribedText) {
      return {
        originalText: "",
        translatedText: "",
        audioBuffer: Buffer.from([])
      };
    }
    
    // Filter out known API artifact - the OpenAI API sometimes returns just "you" 
    // regardless of actual speech content
    if (/^you[.!?,;]*$/i.test(transcribedText.trim())) {
      console.log('Filtering out known OpenAI API artifact: "you" - this is not actual speech content');
      return {
        originalText: "",
        translatedText: "",
        audioBuffer: Buffer.from([])
      };
    }
    
    // Step 2: Translate text if needed
    let translatedText = transcribedText;
    if (sourceLanguage !== targetLanguage && transcribedText.trim().length > 0) {
      try {
        translatedText = await translateText(transcribedText, sourceLanguage, targetLanguage);
      } catch (translationError) {
        console.error('Error in translation, using original text:', translationError);
        translatedText = transcribedText; // Just use original text if translation fails
      }
    }
    
    // Step 3: Convert to speech if not returning to original speaker
    let audioResponse = audioBuffer;
    if (sourceLanguage !== targetLanguage && translatedText.trim().length > 0) {
      try {
        audioResponse = await textToSpeech(translatedText, targetLanguage);
      } catch (ttsError) {
        console.error('Error in text-to-speech:', ttsError);
        // Keep the original audio if TTS fails
      }
    }
    
    console.log(`Successfully processed translation to ${targetLanguage}`);
    console.log(`Translation complete: "${transcribedText}" -> "${translatedText}"`);
    
    return {
      originalText: transcribedText,
      translatedText,
      audioBuffer: audioResponse
    };
  } catch (error) {
    console.error('Error in speech translation:', error);
    // Return an empty result instead of an error message
    return {
      originalText: "",
      translatedText: "",
      audioBuffer: Buffer.from([])
    };
  }
}

/**
 * Transcribes audio to text using OpenAI's Whisper API
 */
export async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  try {
    console.log(`Transcribing audio buffer of size ${audioBuffer.byteLength}...`);
    
    if (!apiKey || apiKey.length === 0) {
      console.warn('OpenAI API key not available, using simulated transcription');
      return "No API key available. Please provide an OpenAI API key.";
    }
    
    // Check if buffer is sufficient for transcription - at least 8000 bytes (about 0.5 sec of audio)
    // This helps avoid the "Audio file is too short" error from OpenAI
    if (audioBuffer.byteLength < 8000) {
      console.warn(`Audio buffer too small for transcription: ${audioBuffer.byteLength} bytes`);
      return ""; // Return empty string for short audio chunks
    }
    
    // Debug audio file format by examining the first 32 bytes
    try {
      const firstBytes = audioBuffer.slice(0, 32);
      const hexDump = firstBytes.toString('hex').match(/.{1,2}/g)?.join(' ') || '';
      console.log(`Audio buffer header (hex): ${hexDump}`);
      
      // Check if file has a valid WAV header
      if (audioBuffer.length > 12) {
        const isWav = 
          audioBuffer[0] === 0x52 && // R
          audioBuffer[1] === 0x49 && // I
          audioBuffer[2] === 0x46 && // F
          audioBuffer[3] === 0x46 && // F
          audioBuffer[8] === 0x57 && // W
          audioBuffer[9] === 0x41 && // A
          audioBuffer[10] === 0x56 && // V
          audioBuffer[11] === 0x45;  // E
        
        console.log(`Audio buffer has valid WAV header: ${isWav}`);
      }
    } catch (debugError) {
      console.error('Error during audio debug:', debugError);
    }
    
    // Create a temporary file for the audio buffer with absolute path
    const tempFilePath = path.join(process.cwd(), 'temp-audio.wav');
    
    try {
      // Write the buffer to a temporary file
      writeFileSync(tempFilePath, audioBuffer);
      console.log(`Saved audio buffer to temporary file: ${tempFilePath}`);
      
      // Use the OpenAI Whisper API for transcription with file read stream
      console.log('Sending read stream to OpenAI API');
      
      console.log('Enhancing audio parameters for better transcription results...');
      
      // Use more parameters to improve transcription accuracy for real-world audio
      const transcription = await openai.audio.transcriptions.create({
        file: createReadStream(tempFilePath),
        model: "whisper-1",
        language: "en", // Make dynamic based on sourceLanguage if needed
        response_format: "json",
        temperature: 0.0, // Use lowest temperature for precise transcription
        prompt: "Transcribe any audible speech, even if it's brief or unclear. This is real-time classroom audio that might include natural pauses, background noise, or incomplete sentences. Detect and transcribe any clear human speech regardless of context.", // More forgiving prompt for real audio
      });
      
      console.log('Full transcription response:', JSON.stringify(transcription));
      
      // Clean up the temporary file
      try {
        unlinkSync(tempFilePath);
        console.log(`Deleted temporary file: ${tempFilePath}`);
      } catch (unlinkError) {
        console.error('Error deleting temporary file:', unlinkError);
      }
      
      console.log('Transcription successful:', transcription);
      
      // Extract text from JSON response
      if (typeof transcription === 'object' && 'text' in transcription) {
        return transcription.text;
      } else if (typeof transcription === 'string') {
        return transcription;
      } else {
        console.warn('Unexpected transcription response format:', transcription);
        return ""; 
      }
    } catch (apiError: any) {
      console.error('OpenAI API error during transcription:', apiError);
      
      // Clean up the temporary file if there's an error
      try {
        unlinkSync(tempFilePath);
        console.log(`Deleted temporary file after error: ${tempFilePath}`);
      } catch (unlinkError) {
        console.error('Error deleting temporary file after API error:', unlinkError);
      }
      
      // Special handling for "audio_too_short" error
      if (apiError.code === 'audio_too_short') {
        console.warn('Audio too short for OpenAI API');
        return ""; // Return empty for too short audio
      }
      
      // For other API errors
      return ""; // Return empty instead of error message
    }
  } catch (error: any) {
    console.error('Error in transcription:', error);
    return ""; // Return empty instead of error message
  }
}

/**
 * Translates text from source to target language
 */
export async function translateText(
  text: string, 
  sourceLanguage: string, 
  targetLanguage: string
): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a professional translator. Translate the following text from ${sourceLanguage} to ${targetLanguage}. Maintain the tone and meaning of the original text. Only respond with the translated text, no explanations or meta-commentary.`
        },
        {
          role: "user",
          content: text
        }
      ]
    });
    
    return completion.choices[0].message.content || "";
  } catch (error) {
    console.error('Error in translation:', error);
    throw error;
  }
}

/**
 * Converts text to speech in specified language
 */
export async function textToSpeech(text: string, language: string): Promise<Buffer> {
  try {
    // Map language codes to voices
    const voiceMap: Record<string, string> = {
      "en-US": "alloy",
      "es": "shimmer",
      "de": "onyx",
      "fr": "nova"
    };
    
    // Default to alloy if language not found
    const voice = voiceMap[language] || "alloy";
    
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice,
      input: text,
    });
    
    // Convert to buffer
    const buffer = Buffer.from(await mp3.arrayBuffer());
    return buffer;
  } catch (error) {
    console.error('Error in text-to-speech:', error);
    throw error;
  }
}
