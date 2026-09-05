// @ts-check
import withNuxt from "./.nuxt/eslint.config.mjs";

export default withNuxt(
  {
    files: ["**/*.ts", "**/*.vue", "eslint.config.mjs"],
    rules: {
      "@stylistic/semi": ["error", "always"], // allow console.log in TypeScript files
      "@stylistic/quotes": ["error", "double"],
      "@typescript-eslint/no-unused-vars": "warn",
      "no-console": "off",
      "no-unused-vars": "off",
      "sort-imports": ["error", {
        ignoreCase: false,
        ignoreDeclarationSort: false,
        ignoreMemberSort: false,
        memberSyntaxSortOrder: ["none", "all", "multiple", "single"],
        allowSeparatedGroups: false
      }],
      "vue/require-v-for-key": "error"
    }
  }
);
