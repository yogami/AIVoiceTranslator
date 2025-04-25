# Benedictaitor Testing Strategy

This document outlines the testing strategy for the Benedictaitor project, following clean code principles and the testing pyramid approach.

## Testing Pyramid

The testing pyramid is a concept that helps us balance our test suite:

```
       /\
      /  \
     /    \
    / E2E  \
   /--------\
  /          \
 / Integration \
/----------------\
/      Unit       \
--------------------
```

1. **Unit Tests** (Base): Test individual components in isolation
2. **Integration Tests** (Middle): Test how components work together
3. **End-to-End Tests** (Top): Test complete user journeys

## Clean Code Testing Principles

Our tests follow these clean code principles:

### 1. Descriptive Test Names

Tests should clearly describe what they're testing:
```typescript
// Good
test('should register role and language when connected')

// Bad
test('test registration')
```

### 2. AAA Pattern (Arrange-Act-Assert)

Tests should follow a clear structure:
```typescript
test('should update client role when register message received', () => {
  // Arrange
  const mockWs = new MockWebSocket();
  const registerMessage = { type: 'register', role: 'teacher' };
  
  // Act
  mockWs.emit('message', registerMessage);
  
  // Assert
  expect(mockWs.role).toBe('teacher');
});
```

### 3. Test Independence

Tests should be independent and not rely on other tests:
```typescript
// Good - Each test sets up its own state
beforeEach(() => {
  wsClient = new WebSocketClient();
});

// Bad - Tests depend on state from previous tests
let wsClient;
beforeAll(() => {
  wsClient = new WebSocketClient();
});
```

### 4. Single Responsibility

Each test should focus on testing one thing:
```typescript
// Good - Test one aspect
test('should send transcription when connected as teacher')

// Bad - Test multiple aspects
test('should connect, register as teacher, and send transcription')
```

## Running Tests

Use the provided script to run tests:

```bash
# Run unit tests
./run-tests.sh unit

# Run integration tests
./run-tests.sh integration

# Run E2E tests
./run-tests.sh e2e

# Run all tests
./run-tests.sh all

# Generate coverage report
./run-tests.sh coverage
```

## Code Quality Principles

Our codebase is designed following these principles:

### SOLID Principles

1. **Single Responsibility Principle**: Each class has one job
2. **Open/Closed Principle**: Open for extension, closed for modification
3. **Liskov Substitution Principle**: Subtypes can be substituted for base types
4. **Interface Segregation Principle**: Specific interfaces are better than general ones
5. **Dependency Inversion Principle**: Depend on abstractions, not concretions

### DRY (Don't Repeat Yourself)

We avoid code duplication by extracting common functionality into reusable components.

### KISS (Keep It Simple, Stupid)

We prioritize simplicity over cleverness. Code should be easy to understand and maintain.

## Test Coverage Goals

- Unit Tests: 80%+ coverage
- Integration Tests: Key component interactions
- E2E Tests: Critical user journeys

## Mocking Strategy

We use mocks to isolate components during testing:
- External services (OpenAI API)
- WebSocket connections
- Browser APIs (Web Speech API)

## Continuous Integration

Tests are run:
- Before merging code
- After deployment to staging
- On schedule to catch regressions