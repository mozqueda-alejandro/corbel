<script setup lang="ts">
import { navigateTo } from "#app";

// Performs a 302 temporary redirect to the index page immediately
await navigateTo("/", { redirectCode: 302 });
</script>

<template>
  <div />
</template>
