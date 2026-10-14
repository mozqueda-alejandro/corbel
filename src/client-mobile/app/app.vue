<script setup lang="ts">
const { isLoading, isAppVisible } = useAppReadiness();
</script>

<template>
  <UApp>
    <div
      v-if="isLoading"
      class="flex min-h-screen items-center justify-center"
    >
      <UIcon
        name="i-lucide-loader-circle"
        class="animate-spin size-8"
      />
    </div>

    <NuxtLayout
      v-else
      :name="isAppVisible ? 'default' : 'empty'"
    >
      <NuxtPage v-if="isAppVisible" />
      <OnboardingForm v-else />
    </NuxtLayout>
  </UApp>
</template>
