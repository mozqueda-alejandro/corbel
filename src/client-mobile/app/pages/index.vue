<script setup lang="ts">
import type { DropdownMenuItem, TableColumn, TabsItem } from "@nuxt/ui";
import { h, resolveComponent } from "vue";

const UButton = resolveComponent("UButton");
const UCheckbox = resolveComponent("UCheckbox");
const UBadge = resolveComponent("UBadge");
const UDropdownMenu = resolveComponent("UDropdownMenu");
const NuxtLink = resolveComponent("NuxtLink");

const route = useRoute();
const router = useRouter();
const toast = useToast();
const { sessionListRef, saveSession, deleteSession, transitionSession } = useSessionRepository();
const { getAvailableTransitionList, runSessionTransition } = useSessionActions();
const { currentUserSettingsRef } = useUserRepository();

// #region SessionCreateModal
const isCreateModalOpen = ref(false);

function navigateToSession(session: Session) {
  navigateTo(`/sessions/${session.id}`);
}

async function handleSessionCreateSubmit(sessionCreateModalData: Session) {
  await saveSession(sessionCreateModalData);

  isCreateModalOpen.value = false;
  navigateToSession(sessionCreateModalData);
}
// #endregion

// #region Views
enum SessionViewEnum {
  Active = "active",
  Archived = "archived"
}

// Kept in the URL so returning from a session lands back on the same view.
const sessionViewRef = computed<SessionViewEnum>({
  get: () => (route.query.view === SessionViewEnum.Archived ? SessionViewEnum.Archived : SessionViewEnum.Active),
  set: (view) => {
    router.replace({ query: { ...route.query, view: view === SessionViewEnum.Active ? undefined : view } });
  }
});

const activeSessionListRef = computed(() => (sessionListRef.value ?? []).filter(sessionItem => sessionItem.status !== SessionStatusEnum.Archived));
const archivedSessionListRef = computed(() => (sessionListRef.value ?? []).filter(sessionItem => sessionItem.status === SessionStatusEnum.Archived));

const visibleSessionListRef = computed(() =>
  sessionViewRef.value === SessionViewEnum.Archived ? archivedSessionListRef.value : activeSessionListRef.value);

const viewTabItemList = computed<TabsItem[]>(() => [
  { label: "Active", value: SessionViewEnum.Active, icon: "i-lucide-calendar", badge: { label: String(activeSessionListRef.value.length), color: "neutral", variant: "subtle" } },
  { label: "Archived", value: SessionViewEnum.Archived, icon: "i-lucide-archive", badge: { label: String(archivedSessionListRef.value.length), color: "neutral", variant: "subtle" } }
]);

const searchQueryRef = ref("");
const rowSelectionRef = ref<Record<string, boolean>>({});
const sortingRef = ref([{ id: "date", desc: true }]);

// Each view has different columns, so selection and sorting don't carry over.
watch(sessionViewRef, () => {
  rowSelectionRef.value = {};
  sortingRef.value = [{ id: "date", desc: true }];
});

const autoArchiveDescriptionRef = computed(() => {
  const { enabled, amount, unit } = currentUserSettingsRef.value.autoArchive;
  if (!enabled) return "Archive completed sessions to keep this list focused.";
  const unitLabel = unit.toLowerCase().replace(/s$/, "");
  return `Completed sessions are archived automatically after ${amount} ${unitLabel}${amount === 1 ? "" : "s"}, or you can archive them yourself.`;
});
// #endregion

// #region Bulk Actions
const selectedSessionListRef = computed(() =>
  visibleSessionListRef.value.filter(sessionItem => rowSelectionRef.value[sessionItem.id]));

const bulkTransitionRef = computed(() =>
  sessionViewRef.value === SessionViewEnum.Archived ? SessionTransitionEnum.Unarchive : SessionTransitionEnum.Archive);

const bulkEligibleSessionListRef = computed(() =>
  selectedSessionListRef.value.filter(sessionItem => canTransitionSession(sessionItem, bulkTransitionRef.value)));

async function handleBulkTransition() {
  const transition = bulkTransitionRef.value;
  const eligibleSessionList = bulkEligibleSessionListRef.value;
  const { label, pastTense, icon } = sessionTransitionDisplayMap[transition];

  const resultList = await Promise.allSettled(eligibleSessionList.map(sessionItem => transitionSession(sessionItem.id, transition)));
  const failedCount = resultList.filter(result => result.status === "rejected").length;
  const succeededCount = resultList.length - failedCount;
  rowSelectionRef.value = {};

  if (succeededCount > 0) {
    toast.add({ title: `${succeededCount} ${succeededCount === 1 ? "session" : "sessions"} ${pastTense}`, color: "success", icon });
  }
  if (failedCount > 0) {
    console.error(`Bulk ${label.toLowerCase()} failed:`, resultList);
    toast.add({ title: `Couldn't ${label.toLowerCase()} ${failedCount} ${failedCount === 1 ? "session" : "sessions"}`, color: "error", icon: "i-lucide-circle-x" });
  }
}
// #endregion

// #region Delete
const sessionPendingDeleteRef = ref<Session>();
const isDeleteSessionModalOpen = computed({
  get: () => !!sessionPendingDeleteRef.value,
  set: (isOpen) => {
    if (!isOpen) sessionPendingDeleteRef.value = undefined;
  }
});

async function handleConfirmDelete() {
  const session = sessionPendingDeleteRef.value;
  if (!session) return;
  try {
    await deleteSession(session.id);
    toast.add({ title: `"${session.name}" deleted`, color: "success", icon: "i-lucide-trash-2" });
  } catch (deleteError) {
    console.error("Session delete failed:", deleteError);
    toast.add({
      title: "Couldn't delete session",
      description: deleteError instanceof Error ? deleteError.message : undefined,
      color: "error",
      icon: "i-lucide-circle-x"
    });
  }
  sessionPendingDeleteRef.value = undefined;
}
// #endregion

// #region Table UI
function formatTableDate(dateValue: Date | undefined) {
  if (!dateValue) return "";
  const date = new Date(dateValue);
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");

  return `${mm}-${dd}-${yy}`;
}

type SortableColumn = {
  getIsSorted: () => false | "asc" | "desc"
  toggleSorting: (desc?: boolean) => void
};

function renderSortableHeader(column: SortableColumn, label: string) {
  const isSorted = column.getIsSorted();

  return h(UButton, {
    color: "neutral",
    variant: "ghost",
    label,
    icon: isSorted ? (isSorted === "asc" ? "i-lucide-arrow-up-narrow-wide" : "i-lucide-arrow-down-wide-narrow") : "i-lucide-arrow-up-down",
    class: "-mx-2.5",
    onClick: () => column.toggleSorting(column.getIsSorted() === "asc")
  });
}

function getRowActionItemList(session: Session): DropdownMenuItem[][] {
  const isLocked = isSessionLocked(session);
  const itemGroupList: DropdownMenuItem[][] = [
    [{
      label: isLocked ? "View" : "Open",
      icon: isLocked ? "i-lucide-eye" : "i-lucide-square-arrow-out-up-right",
      onSelect: () => navigateToSession(session)
    }],
    getAvailableTransitionList(session).map((transition) => {
      const { label, icon } = sessionTransitionDisplayMap[transition];
      const isReExport = transition === SessionTransitionEnum.Export && session.status === SessionStatusEnum.Exported;
      return {
        label: isReExport ? "Re-export" : label,
        icon,
        onSelect: () => { runSessionTransition(session, transition); }
      };
    }),
    [{
      label: "Delete",
      icon: "i-lucide-trash-2",
      color: "error",
      // Locked sessions can't be deleted; revert to draft first.
      disabled: isLocked,
      onSelect: () => { sessionPendingDeleteRef.value = session; }
    }]
  ];
  return itemGroupList.filter(itemGroup => itemGroup.length > 0);
}

const columns = computed<TableColumn<Session>[]>(() => [
  {
    id: "select",
    header: ({ table }) => h(UCheckbox, {
      "modelValue": table.getIsSomePageRowsSelected() ? "indeterminate" : table.getIsAllPageRowsSelected(),
      "onUpdate:modelValue": (value: boolean | "indeterminate") => table.toggleAllPageRowsSelected(!!value),
      "aria-label": "Select all"
    }),
    cell: ({ row }) => h(UCheckbox, {
      "modelValue": row.getIsSelected(),
      "onUpdate:modelValue": (value: boolean | "indeterminate") => row.toggleSelected(!!value),
      "aria-label": "Select row"
    }),
    enableSorting: false,
    enableHiding: false
  }, {
    accessorKey: "name",
    header: ({ column }) => renderSortableHeader(column, "Name"),
    cell: ({ row }) => h(NuxtLink, {
      to: `/sessions/${row.original.id}`,
      class: "font-medium text-highlighted hover:underline"
    }, () => row.original.name)
  }, {
    accessorKey: "date",
    header: ({ column }) => renderSortableHeader(column, "Date"),
    sortingFn: "datetime",
    cell: ({ row }) => formatTableDate(row.original.date)
  }, {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const statusValue = row.original.status;

      return h(UBadge, {
        class: "capitalize",
        variant: "subtle",
        color: sessionStatusColorMap[statusValue] || "neutral",
        icon: sessionStatusIconMap[statusValue]
      }, () => statusValue);
    }
  },
  sessionViewRef.value === SessionViewEnum.Archived
    ? {
        accessorKey: "archivedAt",
        header: ({ column }) => renderSortableHeader(column, "Archived"),
        sortingFn: "datetime",
        cell: ({ row }) => formatTableDate(row.original.archivedAt)
      }
    : {
        accessorKey: "overview",
        header: ({ column }) => renderSortableHeader(column, "Overview"),
        cell: ({ row }) => h("span", { class: "line-clamp-1 text-muted" }, row.original.overview ?? "")
      },
  {
    id: "actions",
    enableHiding: false,
    meta: { class: { td: "text-right" } },
    cell: ({ row }) => h(UDropdownMenu, {
      "content": { align: "end" },
      "items": getRowActionItemList(row.original),
      "aria-label": "Actions dropdown"
    }, () => h(UButton, {
      "icon": "i-lucide-ellipsis-vertical",
      "color": "neutral",
      "variant": "ghost",
      "aria-label": "Actions dropdown"
    }))
  }
]);
// #endregion
</script>

<template>
  <div class="mx-auto flex w-full max-w-6xl flex-col gap-4 px-3 py-5 sm:gap-6 sm:px-6 sm:py-8">
    <div class="flex items-center justify-between gap-3">
      <div class="min-w-0">
        <h2 class="text-xl font-semibold text-highlighted sm:text-2xl">
          Sessions
        </h2>
        <p class="text-sm text-muted">
          Take attendance, record dailies and tests, and export each class session.
        </p>
      </div>
      <UButton
        class="shrink-0"
        label="New Session"
        icon="i-lucide-plus"
        @click="isCreateModalOpen = true"
      />
    </div>

    <div class="overflow-hidden rounded-lg border border-muted bg-default shadow-xs">
      <div class="w-full divide-y divide-muted">
        <div class="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:gap-2 sm:px-4">
          <UTabs
            v-model="sessionViewRef"
            :items="viewTabItemList"
            :content="false"
            size="sm"
            color="neutral"
            class="sm:w-auto"
          />

          <div class="flex flex-wrap items-center gap-2 sm:ms-auto sm:flex-nowrap">
            <UInput
              v-model="searchQueryRef"
              icon="i-lucide-search"
              placeholder="Search sessions..."
              size="sm"
              class="w-full sm:w-64"
            />
          </div>
        </div>

        <div
          v-if="selectedSessionListRef.length > 0"
          class="flex flex-wrap items-center gap-2 bg-elevated/50 px-3 py-2 sm:px-4"
        >
          <span class="me-auto text-sm font-medium">
            {{ selectedSessionListRef.length }} selected
          </span>
          <UButton
            :label="`${sessionTransitionDisplayMap[bulkTransitionRef].label}${bulkEligibleSessionListRef.length > 0 ? ` (${bulkEligibleSessionListRef.length})` : ''}`"
            :icon="sessionTransitionDisplayMap[bulkTransitionRef].icon"
            color="neutral"
            variant="outline"
            size="sm"
            :disabled="bulkEligibleSessionListRef.length === 0"
            loading-auto
            @click="handleBulkTransition"
          />
          <UButton
            label="Clear"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="rowSelectionRef = {}"
          />
        </div>

        <UTable
          v-model:row-selection="rowSelectionRef"
          v-model:sorting="sortingRef"
          v-model:global-filter="searchQueryRef"
          :data="visibleSessionListRef"
          :columns="columns"
          :get-row-id="(sessionItem: Session) => sessionItem.id"
          :loading="sessionListRef === undefined"
          sticky
          class="max-h-[calc(100dvh-22rem)] min-h-64"
        >
          <template #empty>
            <UEmpty
              v-if="searchQueryRef"
              variant="naked"
              icon="i-lucide-search-x"
              title="No matching sessions"
              :description="`Nothing matches &quot;${searchQueryRef}&quot; in ${sessionViewRef} sessions.`"
              :actions="[{ label: 'Clear search', color: 'neutral', variant: 'outline', onClick: () => (searchQueryRef = '') }]"
              class="py-10"
            />
            <UEmpty
              v-else-if="sessionViewRef === SessionViewEnum.Archived"
              variant="naked"
              icon="i-lucide-archive"
              title="No archived sessions"
              :description="autoArchiveDescriptionRef"
              class="py-10"
            />
            <UEmpty
              v-else-if="archivedSessionListRef.length > 0"
              variant="naked"
              icon="i-lucide-calendar-check"
              title="No active sessions"
              description="All of your sessions are archived."
              :actions="[
                { label: 'New Session', icon: 'i-lucide-plus', onClick: () => (isCreateModalOpen = true) },
                { label: 'View archived', icon: 'i-lucide-archive', color: 'neutral', variant: 'outline', onClick: () => (sessionViewRef = SessionViewEnum.Archived) }
              ]"
              class="py-10"
            />
            <UEmpty
              v-else
              variant="naked"
              icon="i-lucide-calendar-plus"
              title="No sessions yet"
              description="Create a session to start taking attendance."
              :actions="[{ label: 'New Session', icon: 'i-lucide-plus', onClick: () => (isCreateModalOpen = true) }]"
              class="py-10"
            />
          </template>
        </UTable>

        <div class="px-3 py-3 text-sm text-muted sm:px-4">
          {{ visibleSessionListRef.length }} {{ visibleSessionListRef.length === 1 ? "session" : "sessions" }}
          <template v-if="sessionViewRef === SessionViewEnum.Archived">
            · Archived sessions are read-only. Unarchive to reopen them.
          </template>
        </div>
      </div>
    </div>

    <SessionCreateModal
      v-model:open="isCreateModalOpen"
      @submit="handleSessionCreateSubmit"
    />
    <UModal
      v-model:open="isDeleteSessionModalOpen"
      title="Delete session"
    >
      <template #body>
        Are you sure you want to delete "{{ sessionPendingDeleteRef?.name }}"? This can't be undone.
      </template>

      <template #footer="{ close }">
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          @click="close"
        >
          Cancel
        </UButton>
        <UButton
          color="error"
          loading-auto
          @click="handleConfirmDelete"
        >
          Delete
        </UButton>
      </template>
    </UModal>
  </div>
</template>
