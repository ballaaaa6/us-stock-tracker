import eslintConfigPrettier from "eslint-config-prettier";

export default [
  eslintConfigPrettier,
  {
    ignores: [
      "dist/**",
      "scratch/**",
      "node_modules/**",
      ".wrangler/**",
      "package-lock.json",
      "*.traineddata"
    ]
  },
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        localStorage: "readonly",
        fetch: "readonly",
        URL: "readonly",
        Image: "readonly",
        FileReader: "readonly",
        Headers: "readonly",
        Request: "readonly",
        Response: "readonly",
        FormData: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        crypto: "readonly",
        Uint8Array: "readonly",
        TextEncoder: "readonly",
        atob: "readonly",
        btoa: "readonly",
        // Test globals (Vitest)
        describe: "readonly",
        it: "readonly",
        expect: "readonly",
        vi: "readonly",
        beforeEach: "readonly"
      }
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": "off",
      "no-undef": "error"
    }
  }
];
