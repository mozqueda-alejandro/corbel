<script setup lang="ts">
import type { TabsItem } from "@nuxt/ui";

const route = useRoute();
const router = useRouter();
const { getSessionById } = useSessionRepository();
const { getAvailableTransitionList, runSessionTransition } = useSessionActions();

const sessionIdRef = computed(() => {
  const sessionIdRaw = route.params.id;
  return (Array.isArray(sessionIdRaw) ? sessionIdRaw[0] : sessionIdRaw) ?? "";
});

// Live so status changes (export, complete, auto-archive) show up without reloading. null means not found.
const { data: sessionRef } = useLiveQuery(
  async () => (await getSessionById(sessionIdRef.value)) ?? null,
  [sessionIdRef]
);

watch(sessionRef, (session) => {
  if (session === null) navigateTo("/");
});

const openSlideover = ref(false);
const attendanceRef = useTemplateRef("attendanceRef");

// #region Lifecycle
const isSessionLockedRef = computed(() => !!sessionRef.value && isSessionLocked(sessionRef.value));

const primaryTransitionByStatusMap: Partial<Record<SessionStatusEnum, SessionTransitionEnum>> = {
  [SessionStatusEnum.Drafting]: SessionTransitionEnum.Export,
  [SessionStatusEnum.Exported]: SessionTransitionEnum.Complete,
  [SessionStatusEnum.Archived]: SessionTransitionEnum.Unarchive
};

const transitionButtonListRef = computed(() => {
  const session = sessionRef.value;
  if (!session) return [];

  const primaryTransition = primaryTransitionByStatusMap[session.status];
  return getAvailableTransitionList(session).map((transition) => {
    const { label, icon } = sessionTransitionDisplayMap[transition];
    const isReExport = transition === SessionTransitionEnum.Export && session.status === SessionStatusEnum.Exported;
    return {
      transition,
      label: isReExport ? "Re-export" : label,
      icon,
      color: transition === primaryTransition ? "primary" as const : "neutral" as const,
      variant: transition === primaryTransition ? "solid" as const : "outline" as const
    };
  });
});

function formatShortDate(date: Date | undefined) {
  return date ? new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";
}

const statusDescriptionRef = computed(() => {
  const session = sessionRef.value;
  if (!session) return "";

  switch (session.status) {
    case SessionStatusEnum.Drafting:
      return session.exportedAt ? "Changed since the last export" : "Not exported yet";
    case SessionStatusEnum.Exported:
      return `Exported ${formatShortDate(session.exportedAt)}`;
    case SessionStatusEnum.Completed:
      return `Completed ${formatShortDate(session.completedAt)} · read-only`;
    case SessionStatusEnum.Archived:
      return `Archived ${formatShortDate(session.archivedAt)} · read-only`;
  }
  return "";
});

const lockedAlertRef = computed(() => {
  const session = sessionRef.value;
  if (!session || !isSessionLocked(session)) return undefined;

  return {
    title: `This session is ${session.status.toLowerCase()} and can't be changed.`,
    description: session.status === SessionStatusEnum.Archived
      ? "Unarchive it, then revert to draft to make changes."
      : "Revert to draft to make changes. Any edits will need to be exported again."
  };
});

const isTransitionRunningRef = ref(false);

async function handleTransition(transition: SessionTransitionEnum) {
  const session = sessionRef.value;
  if (!session || isTransitionRunningRef.value) return;

  isTransitionRunningRef.value = true;
  try {
    // Save any debounced edits first so the transition is checked against what's actually on screen.
    await attendanceRef.value?.flushPendingEdits();
    await runSessionTransition(session, transition);
  } finally {
    isTransitionRunningRef.value = false;
  }
}
// #endregion

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

onMounted(() => {
  if (!sessionIdRef.value) return navigateTo("/");

  if (!route.query.tab) {
    router.replace({
      path: route.path,
      query: { tab: 0 }
    });
  }
});
</script>

<template>
  <div class="flex h-full w-full flex-col">
    <div
      v-if="sessionRef"
      class="shrink-0 space-y-2 border-b border-default px-3 py-2 sm:px-4"
    >
      <div class="flex flex-wrap items-center gap-2">
        <UBadge
          variant="subtle"
          :color="sessionStatusColorMap[sessionRef.status]"
          :icon="sessionStatusIconMap[sessionRef.status]"
          :label="sessionRef.status"
        />
        <span class="min-w-0 truncate text-sm text-muted">
          {{ statusDescriptionRef }}
        </span>
        <div class="ms-auto flex flex-wrap items-center gap-2">
          <UButton
            v-for="transitionButton in transitionButtonListRef"
            :key="transitionButton.transition"
            :label="transitionButton.label"
            :icon="transitionButton.icon"
            :color="transitionButton.color"
            :variant="transitionButton.variant"
            :disabled="isTransitionRunningRef"
            size="sm"
            @click="handleTransition(transitionButton.transition)"
          />
        </div>
      </div>

      <UAlert
        v-if="lockedAlertRef"
        color="neutral"
        variant="subtle"
        icon="i-lucide-lock"
        :title="lockedAlertRef.title"
        :description="lockedAlertRef.description"
        close
      />
    </div>

    <div class="relative min-h-0 flex-1">
      <UTabs
        v-model="active"
        color="neutral"
        :items="tabItems"
        :unmount-on-hide="false"
        :ui="{
          root: 'relative h-full w-full overflow-hidden',
          list: 'absolute bottom-5 left-1/2 -translate-x-1/2 w-[65%] h-12 z-20 justify-around items-center shrink-0 shadow-lg backdrop-blur-md bg-(--ui-bg)/80 border border-(--ui-border)',
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
              ref="attendanceRef"
              :session="sessionRef"
              :readonly="isSessionLockedRef"
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
              :readonly="isSessionLockedRef"
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
              :readonly="isSessionLockedRef"
              class="pb-20"
            />
          </div>
        </template>
      </UTabs>
      <UButton
        icon="i-lucide-notebook-pen"
        color="neutral"
        variant="ghost"
        class="absolute bottom-5 z-20 h-12 w-12 justify-center shadow-lg backdrop-blur-md bg-(--ui-bg)/80 border border-(--ui-border) text-muted"
        style="left: calc(50% + 32.5% + 0.75rem);"
        @click="openSlideover = true"
      />
      <SessionNotesSlideover
        v-if="sessionRef"
        v-model:open="openSlideover"
        :session-id="sessionRef.id"
        :readonly="isSessionLockedRef"
      />
    </div>
  </div>
</template>

<style scoped>

</style>
