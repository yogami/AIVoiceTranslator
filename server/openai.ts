import OpenAI from "openai";
import * as fs from 'fs';
import { writeFileSync, unlinkSync, createReadStream } from 'fs';

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
    
    // Step 2: Translate text if needed
    let translatedText = transcribedText;
    if (sourceLanguage !== targetLanguage) {
      try {
        translatedText = await translateText(transcribedText, sourceLanguage, targetLanguage);
      } catch (translationError) {
        console.error('Error in translation, using original text:', translationError);
        translatedText = `[Could not translate] ${transcribedText}`;
      }
    }
    
    // Step 3: Convert to speech if not returning to original speaker
    let audioResponse = audioBuffer;
    if (sourceLanguage !== targetLanguage) {
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
    // Return a graceful error message
    return {
      originalText: "Error processing speech",
      translatedText: "Error in translation process. Please try again.",
      audioBuffer: Buffer.from([]) // Empty buffer
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
    
    // Check if buffer is sufficient for transcription
    if (audioBuffer.byteLength < 100) {
      console.warn('Audio buffer too small for transcription');
      return "Audio input too short to transcribe.";
    }
    
    // Create a temporary file for the audio buffer
    const tempFilePath = '/tmp/audio-to-transcribe.wav';
    
    try {
      writeFileSync(tempFilePath, audioBuffer);
      
      // Use the OpenAI Whisper API for transcription
      const transcription = await openai.audio.transcriptions.create({
        file: createReadStream(tempFilePath),
        model: "whisper-1",
        language: "en", // Make dynamic based on sourceLanguage if needed
        response_format: "text"
      });
      
      // Clean up the temporary file
      unlinkSync(tempFilePath);
      
      console.log('Transcription successful:', transcription);
      return transcription || "Could not transcribe audio.";
    } catch (apiError) {
      console.error('OpenAI API error during transcription:', apiError);
      // Clean up the temporary file even if there's an error
      try {
        unlinkSync(tempFilePath);
      } catch (unlinkError) {
        console.error('Error deleting temporary file:', unlinkError);
      }
      
      // Fallback for API issues
      return "Error transcribing audio with OpenAI. Please try again.";
    }
  } catch (error: any) {
    console.error('Error in transcription:', error);
    return "Error processing audio data.";
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
