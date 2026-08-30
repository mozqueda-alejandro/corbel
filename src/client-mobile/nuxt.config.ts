export default defineNuxtConfig({
  modules: [
    "@nuxt/eslint",
    "@nuxt/ui"
  ],
  ssr: false,
  srcDir: "app/",
  devtools: {
    enabled: true
  },
  components: true,
  css: ["~/assets/css/main.css"],
  imports: {
    dirs: ["types"]
  },
  runtimeConfig: {
    public: {
      // apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL
    }
  },
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
