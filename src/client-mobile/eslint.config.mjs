// @ts-check
import withNuxt from "./.nuxt/eslint.config.mjs";

export default withNuxt(
  {
    files: ["**/*.ts", "**/*.vue", "eslint.config.mjs"],
    rules: {
      "no-console": "off", // allow console.log in TypeScript files
      "@stylistic/quotes": ["error", "double"],
      "@stylistic/semi": ["error", "always"],
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "vue/require-v-for-key": "error"
    }
  }
);
