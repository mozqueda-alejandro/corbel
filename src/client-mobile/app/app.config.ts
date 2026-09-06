export default defineAppConfig({
  ui: {
    colors: {
      primary: "red",
      neutral: "neutral"
    },
    card: {
      slots: {
        footer: "justify-end"
      }
    },
    modal: {
      slots: {
        footer: "justify-end"
      }
    },
    prose: {
      h1: { base: "text-4xl font-bold text-highlighted" },
      h2: { base: "text-3xl font-bold text-highlighted" },
      h3: { base: "text-2xl font-semibold text-highlighted" }
    }
  }
});
