# TranslationService Testing Guide

This document outlines the testing strategy for the TranslationService and related components in the AIVoiceTranslator project. It follows the principles established in our main TestingStrategy.md, with specific focus on testing ESM modules.

## Key Testing Principles

1. **NEVER modify source code** - Tests should adapt to the code, not vice versa
2. **NEVER mock the System Under Test (SUT)** - Only mock external dependencies
3. **Use REAL implementations** of the systems under test
4. **Keep testing infrastructure isolated** from application code

## Test Setup Structure

We've implemented a completely isolated testing approach:

```
project/
├── server/                      # Application source code (untouched)
│   └── services/
│       ├── TranslationService.ts  # System Under Test
│       └── ...
├── test-config/                 # Test-specific configurations
│   └── vitest/
│       └── vitest.config.mjs    # Isolated Vitest config for ESM tests
├── test-scripts/                # Test execution scripts
│   ├── run-translation-tests.mjs  # Runner for TranslationService.spec.ts
│   └── run-all-translation-tests.sh  # Runs all translation tests
└── tests/
    └── unit/services/
        ├── TranslationService.spec.ts  # Tests using Vitest (ESM compatible)
        └── Translation.test.ts         # Tests using Jest
```

## Testing TranslationService (ESM module)

The TranslationService uses ESM features like `import.meta.url` which are incompatible with CommonJS testing. To solve this, we:

1. Use Vitest which has native ESM support
2. Keep a dedicated config file in `test-config/vitest/`
3. Use a special runner script that executes tests in isolation
4. Mock external dependencies (fs, url, openai) but NEVER the SUT

## Running the Tests

To run TranslationService tests:

```bash
# Run TranslationService tests (ESM compatible)
node test-scripts/run-translation-tests.mjs

# Run all translation-related tests
./test-scripts/run-all-translation-tests.sh
```

Test results are saved in the `test-results/` directory.

## Mocking Strategy

1. **External Dependencies**: We mock external modules like fs, url, and OpenAI
   ```typescript
   // Example - mocking OpenAI
   vi.mock('openai', () => ({
     default: vi.fn().mockImplementation(() => ({
       audio: { /*...*/ },
       chat: { /*...*/ }
     }))
   }));
   ```

2. **Internal Dependencies**: For dependencies of the SUT, we create mock objects and inject them
   ```typescript
   // Example - manually creating and injecting mocks
   const mockTtsService = {
     synthesizeSpeech: vi.fn().mockResolvedValue(/*...*/),
   };
   
   // Injecting the mock
   speechTranslationServiceInstance['ttsFactory'] = mockTtsFactory;
   ```

## Important Notes

1. Testing code should NEVER modify the application source code.
2. Vitest configuration is kept completely separate from Vite configuration.
3. Mock implementations should be defined inline in the test files, not in external files that might affect the application.
4. ESM-related fixes are contained entirely within the testing infrastructure.

By following these guidelines, we maintain a clean separation between application code and testing infrastructure, ensuring that tests can be run without affecting the actual application functionality.