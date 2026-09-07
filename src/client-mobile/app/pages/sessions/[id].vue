<script setup lang="ts">
const props = defineProps<{
  session?: Session
}>();

const route = useRoute();
const { getSessionById } = useSessionRepository();

const sessionRef = ref<Session | undefined>(props.session);

onMounted(async () => {
  if (sessionRef.value) return;

  const sessionIdRaw = route.params.id;
  const sessionId = (Array.isArray(sessionIdRaw) ? sessionIdRaw[0] : sessionIdRaw) ?? "";
  if (!sessionId) return navigateTo("/");

  const session = await getSessionById(sessionId);
  if (!session) return navigateTo("/");

  sessionRef.value = session;
})
</script>

<template>
  <ul>
    <!-- Loop through key and value pairs of the object -->
    <li v-for="(value, key) in sessionRef" :key="key">
      {{ key }}: {{ value }}
    </li>
  </ul>
</template>

<style scoped>

</style>
