# TTS Autoplay Verification Testing

This document outlines the process and tools for verifying the Text-to-Speech (TTS) autoplay functionality in the AIVoiceTranslator application.

## Overview

The TTS autoplay feature ensures that translated speech is automatically played when it's received by a student's device. This feature is critical for providing a seamless classroom experience where students don't need to manually trigger audio playback.

## Verification Process

The TTS autoplay verification tests both OpenAI TTS and Browser TTS services to ensure consistent behavior across different TTS implementations.

### What the Test Verifies

1. **OpenAI TTS Autoplay**: When a translation is sent using OpenAI TTS, the audio automatically plays
2. **Browser TTS Autoplay**: When a translation is sent using Browser's Speech Synthesis API, the audio automatically plays
3. **Consistent Experience**: Both services provide the same autoplay behavior
4. **Parameters Handling**: The `autoPlay` flag is properly passed and processed
5. **UI Feedback**: Appropriate feedback is shown to the user during speech playback

## Automated Testing

### Selenium End-to-End Test

The primary verification method is an automated Selenium test that:

1. Opens two browser tabs (teacher and student)
2. Connects to the WebSocket server from both
3. Tests OpenAI TTS service:
   - Sends a test message from teacher to student
   - Verifies the message is received
   - Verifies the audio automatically plays
4. Tests Browser TTS service:
   - Changes the TTS service to Browser
   - Sends another test message
   - Verifies the audio automatically plays
   - Explicitly checks for the `autoPlay` flag in logs

### Running the Test Locally

```bash
# Run just the TTS autoplay test
./run-tts-autoplay-test.sh

# Or run it as part of all tests
./run-tests.sh tts-autoplay
```

### CI/CD Integration

The test is automatically run in GitHub Actions when:
- Changes are made to the TTS service implementation
- Changes are made to the WebSocket server
- Changes are made to the client HTML/JS that handles speech
- The test itself is modified

The workflow file is located at `.github/workflows/tts-autoplay-verification.yml`.

## Manual Verification

For manual verification:

1. Open the teacher interface and connect
2. Open the student interface in a separate tab and connect
3. Send a message from the teacher
4. Verify the audio plays automatically on the student's interface
5. Change TTS service from OpenAI to Browser in the teacher settings
6. Send another message
7. Verify the audio still plays automatically with Browser TTS

## Debugging Issues

If the autoplay feature isn't working:

1. Check the browser console for errors
2. Verify that the `autoPlay` flag is being passed correctly in the WebSocket message
3. Ensure the browser's autoplay policy isn't blocking audio (some browsers require user interaction)
4. Verify that the TTS service is properly initialized
5. Check network requests to see if audio data is being correctly transmitted

## Potential Issues

- **Browser Autoplay Policies**: Some browsers restrict autoplay without user interaction. The test uses special Chrome flags to bypass this.
- **WebSocket Connection Issues**: If the WebSocket connection fails, the test will fail.
- **Audio Device Availability**: The test requires a virtual audio device in CI environments.

## Related Files

- `tests/selenium/tts_autoplay_verification.js`: The Selenium test script
- `client/public/simple-student.html`: Student interface that processes autoplay flag
- `server/services/WebSocketServer.ts`: Server that sends translation messages with autoPlay flag
- `server/services/TextToSpeechService.ts`: TTS service implementation

## Best Practices

1. Always run the autoplay verification test after making changes to the TTS services
2. Ensure the test passes in both local and CI environments
3. Be cautious of browser autoplay policies when testing manually
4. Document any changes to the autoplay behavior or implementation
5. **Review all markdown files in the `attached_assets` folder** to ensure implementation aligns with project requirements and specifications
   - Pay special attention to voice translation competitor analysis documents
   - Review all TTS-related technical documentation
   - Ensure UI/UX requirements for autoplay are met

## Clean Code & Craftsmanship Review for TTS Autoplay

Before implementing or modifying any TTS autoplay feature, you must refresh your knowledge of software craftsmanship best practices:

1. **Clean Code Review**: 
   - [ ] Study `Clean-Code-Cheat-Sheet-V1.3.md` thoroughly
   - [ ] Pay special attention to Function Design, Error Handling, and Comments sections
   - [ ] Apply Single Responsibility Principle to speech-related code

2. **TDD Methodology**: 
   - [ ] Review `Clean-TDD-Cheat-Sheet-V1.2.md` in full
   - [ ] Follow Red-Green-Refactor cycle strictly for all TTS autoplay code
   - [ ] Write test cases first for all autoplay scenarios

3. **Software Craftsmanship**:
   - [ ] Read `pragmatic-principles-cheat-sheet.v1.md` to internalize best practices
   - [ ] Apply DRY (Don't Repeat Yourself) to speech synthesis code
   - [ ] Use SOLID principles in TTS service design

## Documentation Reference Checklist

After reviewing clean code and TDD principles, refer to these specific project documents:

- [ ] Review `voice_translation_competitor_analysis_updated.pdf` for industry standard approaches
- [ ] Check `AIVoiceTranslator_Proof_of_Concept_Modified.pdf` for initial design requirements
- [ ] Consult `Functional_Prototype_Product_Requirements_Updated_Modified.pdf` for detailed specifications
- [ ] Read `Realtime_Audio_Translation_Replit_Guide_Modified.pdf` for technical implementation guidance
- [ ] Reference `code-quality-metrics-cheatsheet.md` for quality standards

This review process must be completed every time you work on TTS autoplay functionality, no exceptions.