import tseslint from "@typescript-eslint/eslint-plugin";

// ESLint v9+ flat config for your project
export default [
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        window: "readonly",
        document: "readonly",
        Node: "readonly",
        module: "readonly",
        require: "readonly",
        process: "readonly"
      }
    },
    plugins: {
      "@typescript-eslint": tseslint
    },
    files: ["**/*.{js,ts,tsx,jsx}"],
    ignores: ["node_modules/**", "dist/**"],
    rules: {
      "no-unused-vars": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "semi": ["error", "always"],
      "quotes": ["error", "double"]
    }
  }
];
