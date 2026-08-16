export default defineNuxtPlugin(() => {
  const { public: { apiBaseUrl } } = useRuntimeConfig();

  return {
    provide: {
      api: (path: string, options?: Parameters<typeof $fetch>[1]) =>
        $fetch(`${apiBaseUrl}${path}`, options),
    },
  }
})
