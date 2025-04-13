import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const apiKey = process.env.OPENAI_API_KEY || "";

// Initialize OpenAI client
const openai = new OpenAI({ apiKey });

/**
 * Handles direct speech-to-speech translation using OpenAI's Realtime API
 * Note: This is a simplified implementation since the actual Realtime API 
 * would require streaming both to and from the API
 */
export async function translateSpeech(
  audioBuffer: Buffer,
  sourceLanguage: string,
  targetLanguage: string
) {
  try {
    // Note: This is a placeholder for OpenAI's Realtime API which doesn't exist in this form yet
    // In a real implementation, we would stream audio to the API and receive audio back
    
    // For now, we'll use the audio transcription + chat completion + TTS pipeline
    // 1. Transcribe audio
    const transcription = await transcribeAudio(audioBuffer);
    
    // 2. Translate text
    const translatedText = await translateText(transcription, sourceLanguage, targetLanguage);
    
    // 3. Convert to speech
    const translatedSpeech = await textToSpeech(translatedText, targetLanguage);
    
    return {
      originalText: transcription,
      translatedText,
      audioBuffer: translatedSpeech
    };
  } catch (error) {
    console.error('Error in speech translation:', error);
    throw error;
  }
}

/**
 * Transcribes audio to text
 */
export async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  try {
    // Create a readable stream from the buffer
    const transcription = await openai.audio.transcriptions.create({
      file: new File([audioBuffer], "audio.wav", { type: "audio/wav" }),
      model: "whisper-1",
      language: "en", // Default to English
    });
    
    return transcription.text;
  } catch (error) {
    console.error('Error in transcription:', error);
    throw error;
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
