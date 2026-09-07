// @ts-check
import simpleImportSort from "eslint-plugin-simple-import-sort";

import withNuxt from "./.nuxt/eslint.config.mjs";

export default withNuxt({
  files: ["**/*.ts", "**/*.vue", "eslint.config.mjs"],
  ignores: [".nuxt/**", "dist/**", "node_modules/**"],
  plugins: { "simple-import-sort": simpleImportSort },
  rules: {
    "@stylistic/function-call-argument-newline": ["error", "consistent"],
    "@stylistic/function-paren-newline": ["error", "multiline"],
    "@stylistic/newline-per-chained-call": ["error", { ignoreChainWithDepth: 3 }],
    "@stylistic/semi": ["error", "always"], // allow console.log in TypeScript files
    "@stylistic/quotes": ["error", "double"],
    "@typescript-eslint/no-unused-vars": "warn",
    "no-console": "off",
    "no-unused-vars": "off",
    "object-curly-newline": ["error", {
      ObjectExpression: { consistent: true },
      ObjectPattern: { consistent: true },
      ImportDeclaration: { consistent: true },
      ExportDeclaration: { consistent: true }
    }],
    "object-property-newline": [
      "error",
      { allowAllPropertiesOnSameLine: true }
    ],
    "simple-import-sort/imports": "error",
    "simple-import-sort/exports": "error",
    "sort-imports": "off",
    "import/order": "off",
    "vue/require-v-for-key": "error"
  }
});
