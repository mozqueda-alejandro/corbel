<script setup lang="ts">
import type { NavigationMenuItem } from "@nuxt/ui";

useHead({
  meta: [
    { name: "viewport", content: "width=device-width, initial-scale=1" }
  ],
  link: [
    { rel: "icon", href: "/favicon.ico" }
  ],
  htmlAttrs: {
    lang: "en"
  }
});

const title = "Corbel Tracker";
const description = "A production-ready starter template powered by Nuxt UI. Build beautiful, accessible, and performant applications in minutes, not hours.";

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  ogImage: "https://ui.nuxt.com/assets/templates/nuxt/starter-light.png",
  twitterImage: "https://ui.nuxt.com/assets/templates/nuxt/starter-light.png",
  twitterCard: "summary_large_image"
});

const route = useRoute();

const items = computed<NavigationMenuItem[]>(() => [{
  label: "Sessions",
  to: "/",
  active: route.path.endsWith("/")
}, {
  label: "Contacts",
  to: "/contacts",
  active: route.path.startsWith("/contacts")
}, {
  label: "Assessments",
  to: "/assessments",
  active: route.path.startsWith("/assessments")
}]);
</script>

<template>
  <UApp>
    <UHeader>
      <template #title>
        <AppLogo class="h-6 w-auto" />
      </template>

      <UNavigationMenu :items="items" />

      <template #right>
        <UColorModeButton />

        <UButton
          color="neutral"
          variant="ghost"
          target="_blank"
          icon="i-lucide-settings"
          aria-label="Settings"
        />
      </template>

      <template #body>
        <UNavigationMenu
          :items="items"
          orientation="vertical"
          class="-mx-2.5"
        />
      </template>
    </UHeader>
    <UMain>
      <NuxtPage />
    </UMain>
  </UApp>
</template>
