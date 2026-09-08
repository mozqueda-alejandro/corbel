<script setup lang="ts">
const { isLoading, isReady } = useAppReadiness();
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
      :name="isReady ? 'default' : 'empty'"
    >
      <NuxtPage v-if="isReady" />
      <OnboardingForm v-else />
    </NuxtLayout>
  </UApp>
</template>
