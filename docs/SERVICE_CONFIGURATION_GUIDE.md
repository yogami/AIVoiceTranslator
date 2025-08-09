# Service Configuration Guide

This guide explains how to configure the speech processing services (STT, Translation, TTS) in the AI Voice Translator application.

## Environment Variables

The application uses three main environment variables to control which service implementations are used:

### STT (Speech-to-Text) Service: `STT_SERVICE_TYPE`
- `openai` - OpenAI Whisper API (Premium, requires OPENAI_API_KEY)
- `elevenlabs` - ElevenLabs STT API (Premium, requires ELEVENLABS_API_KEY)
- `whispercpp` - Local Whisper.cpp (✅ **FREE**, no API key required) **[TESTED & VERIFIED]**
- `auto` - Auto-fallback: Whisper (FREE) → OpenAI (PAID) → ElevenLabs (EXPENSIVE) (Default)

### Translation Service: `TRANSLATION_SERVICE_TYPE`
- `openai` - OpenAI Translation (Premium, requires OPENAI_API_KEY)
- `mymemory` - MyMemory Translation (✅ **FREE**, no API key required) **[TESTED & VERIFIED]**
- `auto` - Auto-fallback: OpenAI → MyMemory (Default)

### TTS (Text-to-Speech) Service: `TTS_SERVICE_TYPE`
- `elevenlabs` - ElevenLabs TTS (Premium, requires ELEVENLABS_API_KEY)
- `openai` - OpenAI TTS (Premium, requires OPENAI_API_KEY)
- `local` - Local eSpeak-NG TTS (✅ **RECOMMENDED FREE**, no API key required) **[NEWLY ADDED & TESTED]**
- `browser` - Browser Web Speech API (✅ **FREE**, client-side, basic quality)
- `auto` - Auto-fallback: Local (FREE) → Browser (FREE) → OpenAI (PAID) → ElevenLabs (EXPENSIVE) (Default)

## 🆕 **NEW: Enhanced FREE Tier Configuration**

The application now supports **high-quality FREE services** for users who cannot afford premium APIs:

### **Complete FREE Configuration** (Recommended for Free Tier):
```env
STT_SERVICE_TYPE=whispercpp      # Local Whisper.cpp (FREE)
TRANSLATION_SERVICE_TYPE=mymemory # MyMemory API (FREE)
TTS_SERVICE_TYPE=local           # Local eSpeak-NG (FREE, HIGH QUALITY)
```

### **Service Quality Comparison**:

#### **TTS Service Quality Ranking**:
1. **ElevenLabs** (Premium) - Highest quality, natural voices
2. **OpenAI** (Premium) - High quality, multiple voices  
3. **🆕 Local eSpeak-NG** (FREE) - **Good quality, 100+ languages, offline**
4. **Browser TTS** (FREE) - Basic quality, limited voices

#### **Key Benefits of Local eSpeak-NG TTS**:
- ✅ **Completely FREE** - No API keys or costs
- ✅ **High Quality** - Much better than browser TTS
- ✅ **100+ Languages** - Extensive language support
- ✅ **Offline** - Works without internet connection
- ✅ **Privacy** - No data sent to external servers
- ✅ **Reliable** - No rate limits or API quotas

## Auto-Fallback Behavior

### 4-Tier TTS Auto-Fallback (Default):
1. **ElevenLabs** (if API key available)
2. **OpenAI** (if API key available)  
3. **🆕 Local eSpeak-NG** (always available)
4. **Browser TTS** (final fallback)

### 3-Tier STT Auto-Fallback:
1. **OpenAI Whisper** (if API key available)
2. **ElevenLabs STT** (if API key available)
3. **Whisper.cpp** (local fallback)

### 2-Tier Translation Auto-Fallback:
1. **OpenAI** (if API key available)
2. **MyMemory** (free fallback)

## Usage Examples

### Testing Free Tier Services:
```bash
# Set environment to use all free services
export STT_SERVICE_TYPE=whispercpp
export TRANSLATION_SERVICE_TYPE=mymemory  
export TTS_SERVICE_TYPE=local

# Start the server
npm run dev
```

### Testing Premium Services:
```bash
# Set environment to use premium services
export STT_SERVICE_TYPE=openai
export TRANSLATION_SERVICE_TYPE=openai
export TTS_SERVICE_TYPE=elevenlabs

# Ensure API keys are set
export OPENAI_API_KEY=your_key
export ELEVENLABS_API_KEY=your_key

# Start the server
npm run dev
```

### Mixed Configuration:
```bash
# Use free STT and Translation, premium TTS
export STT_SERVICE_TYPE=whispercpp
export TRANSLATION_SERVICE_TYPE=mymemory  
export TTS_SERVICE_TYPE=elevenlabs
export ELEVENLABS_API_KEY=your_key
```

## Browser TTS Fix

The student interface now properly handles both **Local TTS** (server-side) and **Browser TTS** (client-side):

- **Local TTS**: Generates high-quality audio server-side, sends MP3/WAV to client
- **Browser TTS**: Sends instructions to client to use Web Speech API for synthesis

Both approaches support autoplay and manual replay functionality.

## Troubleshooting

### Common Issues:
1. **Local TTS not working**: Check if `text2wav` package is installed: `npm list text2wav`
2. **Whisper.cpp initialization slow**: First startup may take longer to download models
3. **MyMemory rate limits**: Free tier has usage limits, will fallback to other services
4. **Browser TTS autoplay blocked**: Modern browsers block autoplay, user interaction required

### Testing Service Availability:
The application includes built-in service testing. Check server logs for initialization messages:
- `[Local TTS] Service initialized with eSpeak-NG, supporting X languages`
- `[WhisperCpp] Service initialized with model: base`
- `[MyMemory] Translation service initialized` 