# Service Tier Environment Configuration Guide

This guide explains how to configure the 4-tier service architecture using environment variables.

## 🔧 Quick Setup

### 1. Copy Environment Templates
```bash
# Production environment
cp config/env.example .env

# Test environment  
cp config/env.test.example .env.test
```

### 2. Update with Your API Keys
Edit `.env` and add your actual API keys:
```bash
OPENAI_API_KEY=sk-your-actual-openai-key-here
ELEVENLABS_API_KEY=your-actual-elevenlabs-key-here
```

## 🎯 Service Tier Configuration

All services use a **4-tier architecture** with automatic fallback:

### 📢 STT (Speech-to-Text) Service Tiers

Configure with `STT_SERVICE_TYPE` environment variable:

| Tier | Value | Service | Requirements | Quality |
|------|-------|---------|--------------|---------|
| **1a** | `premium-openai` | OpenAI STT | `OPENAI_API_KEY` | 🏆 Highest |
| **1b** | `premium-labs` | ElevenLabs STT | `ELEVENLABS_API_KEY` | 🏆 Highest |
| **2** | `free-hq` | Deepgram Nova-2 | None | ⭐ Excellent |
| **3** | `free-enhanced` | Whisper.cpp + Voice Isolation | None | 🔧 Good+ |
| **4** | `free-basic` | Whisper.cpp Basic | None | 🆓 Basic |
| **Auto** | `auto` | **All tiers with fallback** | None | 🚀 **Recommended** |

**Default:** `auto` (uses all tiers with automatic fallback)

**Fallback Order:** Whisper (FREE) → OpenAI (PAID) → ElevenLabs (EXPENSIVE)

### 🌐 Translation Service Tiers

Configure with `TRANSLATION_SERVICE_TYPE` environment variable:

| Tier | Value | Service | Requirements | Quality |
|------|-------|---------|--------------|---------|
| **1** | `premium` | OpenAI Translation | `OPENAI_API_KEY` | 🏆 Highest |
| **2** | `free-hq` | DeepSeek Translation | None | ⭐ Excellent |
| **3** | `free-basic` | MyMemory Translation | None | 🆓 Good |
| **4** | `offline` | Offline Translation | None | 📱 Basic |
| **Auto** | `auto` | **All tiers with fallback** | None | 🚀 **Recommended** |

**Default:** `auto` (uses all tiers with automatic fallback)

**Fallback Order:** OpenAI → DeepSeek → MyMemory → Offline

### 🔊 TTS (Text-to-Speech) Service Tiers

Configure with `TTS_SERVICE_TYPE` environment variable:

| Tier | Value | Service | Requirements | Quality |
|------|-------|---------|--------------|---------|
| **1a** | `premium-labs` | ElevenLabs TTS | `ELEVENLABS_API_KEY` | 🏆 Highest |
| **1b** | `premium-openai` | OpenAI TTS | `OPENAI_API_KEY` | 🏆 High |
| **2** | `free-hq` | Local eSpeak-NG | None | 🖥️ Excellent |
| **3** | `free-basic` | Browser TTS | None | 🌐 Good |
| **4** | `silent` | Silent Mode | None | 🔇 Fallback |
| **Auto** | `auto` | **All tiers with fallback** | None | 🚀 **Recommended** |

**Default:** `auto` (uses all tiers with automatic fallback)

**Fallback Order:** Local (FREE) → Browser (FREE) → OpenAI (PAID) → ElevenLabs (EXPENSIVE) → Silent

## 🎚️ Configuration Examples

### Free Tier Only (No API Keys Required)
```bash
STT_SERVICE_TYPE=free-hq          # Deepgram Nova-2
TRANSLATION_SERVICE_TYPE=free-hq  # DeepSeek
TTS_SERVICE_TYPE=free-hq          # Local eSpeak-NG
```

### Premium Only (Requires API Keys)
```bash
STT_SERVICE_TYPE=premium-openai      # OpenAI STT
TRANSLATION_SERVICE_TYPE=premium     # OpenAI Translation  
TTS_SERVICE_TYPE=premium-labs        # ElevenLabs TTS
OPENAI_API_KEY=sk-your-key-here
ELEVENLABS_API_KEY=your-key-here
```

### Recommended (Auto-Fallback)
```bash
STT_SERVICE_TYPE=auto             # All tiers with fallback
TRANSLATION_SERVICE_TYPE=auto     # All tiers with fallback
TTS_SERVICE_TYPE=auto            # All tiers with fallback
# API keys optional - will use free tiers as fallback
```

## 🧪 Test Environment Configuration

The test environment includes special configurations:

### Test-Specific Features
- **Mock Services:** Whisper.cpp uses mocks in test environment
- **Faster Timeouts:** Reduced timing for faster test execution
- **Test Detection:** Automatic test environment detection

### Test Environment Variables
```bash
NODE_ENV=test
VITEST=true
TEST_TIMING_SCALE=0.01           # 100x faster timing for tests
STT_SERVICE_TYPE=auto            # Recommended for tests
TRANSLATION_SERVICE_TYPE=auto    # Recommended for tests  
TTS_SERVICE_TYPE=auto           # Recommended for tests
```

## 🚀 Production Recommendations

### High-Quality Setup (With API Keys)
```bash
# Recommended for production with API keys
STT_SERVICE_TYPE=auto
TRANSLATION_SERVICE_TYPE=auto
TTS_SERVICE_TYPE=auto
OPENAI_API_KEY=sk-your-production-key
ELEVENLABS_API_KEY=your-production-key
```

### Free Tier Setup (No API Keys)
```bash
# Recommended for production without API keys
STT_SERVICE_TYPE=auto            # Will use free tiers
TRANSLATION_SERVICE_TYPE=auto    # Will use free tiers
TTS_SERVICE_TYPE=auto           # Will use free tiers
```

## 🔍 Service Tier Status Verification

Check which services are being used by looking at the logs:

```bash
# STT Service Logs
[STTFactory] Creating Tier 1a (Premium): OpenAI STT
[STTFactory] Creating 4-tier auto-fallback: Premium → Deepgram → Enhanced Whisper → Basic Whisper

# Translation Service Logs  
[TranslationFactory] Tier 1 (Premium) available: OpenAI
[TranslationFactory] Creating 4-tier auto-fallback: OpenAI → DeepSeek → MyMemory → Offline

# TTS Service Logs
[TTSFactory] Tier 1a (Premium) available: ElevenLabs  
[TTSFactory] Creating 4-tier auto-fallback: Premium → Local → Browser → Silent
```

## 📚 Additional Configuration

### Whisper Model Configuration
```bash
# Configure Whisper.cpp model for local STT processing
WHISPER_MODEL=base               # Options: tiny, base, small, medium, large
```

### Advanced Features
```bash
# Enable detailed logging for debugging
ENABLE_DETAILED_TRANSLATION_LOGGING=true

# Test timing optimization
TEST_TIMING_SCALE=0.01          # Only for test environment
```

## 🔧 Troubleshooting

### Common Issues

1. **Whisper.cpp `process.exit` Error in Tests**
   - ✅ **Fixed!** Test environment now uses automatic mocking
   - Services automatically detect test environment and use mock fallbacks

2. **API Key Not Working**
   - Verify format: OpenAI keys start with `sk-`
   - Check ElevenLabs API key is valid
   - Use `auto` tier to fallback to free services

3. **Service Not Available**  
   - Use `auto` tier for automatic fallback
   - Check API key environment variables
   - Verify network connectivity for cloud services

### Environment Validation
```bash
# Use the management script to validate configuration
./scripts/manage-env.sh
# Choose option 3: "Validate current environment"
```

## 🎉 Success Indicators

Your configuration is working correctly when you see:

1. **Server Startup Logs:**
   ```
   [SpeechPipelineOrchestrator] Initialized with 4-tier fallback architecture
   ```

2. **Service Creation Logs:**
   ```
   [STTFactory] Created and cached auto service
   [TranslationFactory] Created and cached auto service  
   [TTSFactory] Created and cached auto service
   ```

3. **Integration Tests Passing:**
   ```
   ✅ Speech Translation Orchestrator: 13/13 tests passing
   ✅ WebSocket Integration: 9/9 tests passing
   ```

The 4-tier architecture ensures your application works reliably across all deployment scenarios! 🚀
