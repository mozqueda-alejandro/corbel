<script setup lang="ts">
import type { TabsItem } from "@nuxt/ui";

import Dailies from "~/components/Session/Dailies.vue";

const props = defineProps<{
  session?: Session
}>();

const route = useRoute();
const router = useRouter();
const { getSessionById } = useSessionRepository();

const sessionRef = ref<Session | undefined>(props.session);

const tabItems: TabsItem[] = [
  {
    label: "Attendance",
    icon: "i-lucide-user-check",
    slot: "attendance" as const
  },
  {
    label: "Dailies",
    icon: "i-lucide-list-checks",
    slot: "dailies" as const
  },
  {
    label: "Tests",
    icon: "i-lucide-clipboard-list",
    slot: "tests" as const
  }
];

const active = computed({
  get() {
    return (route.query.tab as string) || "attendance";
  },
  set(tab) {
    router.push({
      path: route.path,
      query: { tab }
    });
  }
});

onMounted(async () => {
  if (sessionRef.value) return;

  const sessionIdRaw = route.params.id;
  const sessionId = (Array.isArray(sessionIdRaw) ? sessionIdRaw[0] : sessionIdRaw) ?? "";
  if (!sessionId) return navigateTo("/");

  const session = await getSessionById(sessionId);
  if (!session) return navigateTo("/");

  sessionRef.value = session;

  if (!route.query.tab) {
    router.replace({
      path: route.path,
      query: { tab: 0 }
    });
  }
});
</script>

<template>
  <UContainer class="my-8">
    <UTabs
      v-model="active"
      color="neutral"
      :items="tabItems"
      :unmount-on-hide="false"
      :ui="{
        root: 'flex flex-col-reverse h-screen',
        list: 'justify-around w-full shrink-0 sticky bottom-0 bg-default z-10 w-[75%]',
        content: 'flex-1 overflow-y-auto',
        trigger: 'grow flex-col gap-1 py-1',
        label: 'text-[10px]/3'
      }"
      class="w-full"
    >
      <template #attendance>
        <SessionAttendance />
      </template>
      <template #dailies>
        <SessionDailies />
      </template>
      <template #tests>
        <SessionTests />
      </template>
    </UTabs>
  </UContainer>
</template>

<style scoped>

</style>
