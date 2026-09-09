<script setup lang="ts">
import type { TabsItem } from "@nuxt/ui";

const props = defineProps<{
  session?: Session
}>();

const route = useRoute();
const router = useRouter();
const { getSessionById } = useSessionRepository();

const sessionRef = ref<Session | undefined>(props.session);

enum SessionTypeEnum {
  Attendance = "Attendance",
  Dailies = "Dailies",
  Tests = "Tests"
}
const tabItems: TabsItem[] = [
  {
    label: SessionTypeEnum.Attendance,
    slot: SessionTypeEnum.Attendance.toLowerCase()
  },
  {
    label: SessionTypeEnum.Dailies,
    slot: SessionTypeEnum.Dailies.toLowerCase()
  },
  {
    label: SessionTypeEnum.Tests,
    slot: SessionTypeEnum.Tests.toLowerCase()
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
  <UTabs
    v-model="active"
    color="neutral"
    :items="tabItems"
    :unmount-on-hide="false"
    :ui="{
      root: 'relative h-full w-full overflow-hidden',
      list: 'absolute bottom-5 left-1/2 -translate-x-1/2 w-[65%] z-20 justify-around shrink-0 shadow-lg backdrop-blur-md bg-(--ui-bg)/80 border border-(--ui-border)',
      content: 'relative h-full w-full overflow-y-auto pt-4'
    }"
    class="w-full"
  >
    <template #attendance>
      <div
        v-if="sessionRef"
        class="min-h-full w-full"
      >
        <SessionAttendance
          :session="sessionRef"
          class="pb-20"
        />
      </div>
    </template>
    <template #dailies>
      <div
        v-if="sessionRef"
        class="min-h-full w-full"
      >
        <SessionDailies
          :session="sessionRef"
          class="pb-20"
        />
      </div>
    </template>
    <template #tests>
      <div
        v-if="sessionRef"
        class="min-h-full w-full"
      >
        <SessionTests
          :session="sessionRef"
          class="pb-20"
        />
      </div>
    </template>
  </UTabs>
</template>

<style scoped>

</style>
