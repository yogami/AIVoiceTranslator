
# Fixing Jest ES Module Errors in TypeScript Projects

If you're encountering the following error while testing a TypeScript/JavaScript module using Jest with ESM features like `import.meta.url`:

```
SyntaxError: Identifier '__filename' has already been declared
```

Follow this step-by-step guide to fix the issue **without modifying your source code**.

---

## ✅ 1. Ensure ESM Mode in `package.json`

Make sure your project uses ES Modules:

```json
{
  "type": "module"
}
```

This enables `import`, `import.meta.url`, etc.

---

## ✅ 2. Rename and Update Jest Config to Support ESM

Rename `jest.config.cjs` to `jest.config.js`:

```bash
mv jest.config.cjs jest.config.js
```

Then configure it like this:

```js
// jest.config.js
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  globals: {
    'ts-jest': {
      useESM: true
    }
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true }]
  }
};
```

---

## ✅ 3. Update `tsconfig.json`

Ensure your compiler options are compatible with ESM:

```json
{
  "compilerOptions": {
    "module": "ESNext",
    "target": "ES2020",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "sourceMap": true
  }
}
```

---

## ✅ 4. Install Required Dependencies

Install all necessary dev dependencies:

```bash
npm install --save-dev jest ts-jest @types/jest
npm install --save-dev jest-environment-node
```

---

## ✅ 5. Avoid Redefining `__filename`

In your module code:

```ts
const __filename = fileURLToPath(import.meta.url);
```

If this appears in a file being tested, and Jest already provides `__filename`, this can cause a **duplicate declaration**.

✅ **Solution**: Wrap it in a function/local scope or remove it if not strictly needed.

---

## ✅ Summary Checklist

- [x] `"type": "module"` in `package.json`
- [x] `jest.config.js` using `ts-jest/presets/default-esm`
- [x] Use `useESM: true` and `extensionsToTreatAsEsm`
- [x] Let Jest manage `__filename`, or scope it

---

## Optional: Map Aliases

You can map TypeScript paths in `jest.config.js` using `moduleNameMapper` if needed.

---

This setup will allow you to test ES module code using Jest without errors from CommonJS limitations.
