export default defineNuxtConfig({
  modules: [
    "@nuxt/eslint",
    "@nuxt/ui"
  ],
  ssr: false,
  components: true,
  imports: {
    dirs: ["types"]
  },
  devtools: {
    enabled: true
  },
  css: ["~/assets/css/main.css"],
  runtimeConfig: {
    public: {
      // apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL
    }
  },
  srcDir: "app/",
  routeRules: {
    "/": { prerender: true }
  },
  compatibilityDate: "2025-01-15",
  eslint: {
    config: {
      stylistic: {
        commaDangle: "never",
        braceStyle: "1tbs"
      }
    }
  }
});
