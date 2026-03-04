"use strict";
const tsParser = require("@typescript-eslint/parser");
const almadarPlugin = require("@almadar/eslint-plugin");

module.exports = [
  { ignores: ["dist/**", "node_modules/**", "**/*.config.ts", "vitest.config.ts", "tsup.config.ts"] },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module" },
    },
    plugins: { almadar: almadarPlugin },
    rules: {
      "almadar/no-as-any": "error",
      "almadar/no-import-generated": "error",
    },
  },
];
