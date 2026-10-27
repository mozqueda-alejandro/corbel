<script setup lang="ts">
import type { DropdownMenuItem, TableColumn } from "@nuxt/ui";
import { h, resolveComponent } from "vue";

import type { TestVariant } from "~/schemas/test-variant.schema";

const UButton = resolveComponent("UButton");
const UCheckbox = resolveComponent("UCheckbox");
const UDropdownMenu = resolveComponent("UDropdownMenu");

const toast = useToast();
const { testVariantListRef, saveTestVariantList, deleteTestVariantList } = useTestVariantRepository();
const { sessionListRef } = useSessionRepository();

function showError(title: string, description?: string) {
  toast.add({ title, description, color: "error", icon: "i-lucide-circle-x" });
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

// #region Selection
const searchQueryRef = ref("");
const rowSelectionRef = ref<Record<string, boolean>>({});
const sortingRef = ref([{ id: "name", desc: false }]);

const selectedTestListRef = computed(() =>
  (testVariantListRef.value ?? []).filter(test => rowSelectionRef.value[test.id]));
// #endregion

// #region Edit
const isEditModalOpenRef = ref(false);
const editingTestRef = ref<TestVariant>();

function openNewTestModal() {
  editingTestRef.value = undefined;
  isEditModalOpenRef.value = true;
}

function openEditModal(test: TestVariant) {
  editingTestRef.value = test;
  isEditModalOpenRef.value = true;
}
// #endregion

// #region Delete
const testListPendingDeleteRef = ref<TestVariant[]>([]);
const isDeleteModalOpenRef = computed({
  get: () => testListPendingDeleteRef.value.length > 0,
  set: (isOpen) => {
    if (!isOpen) testListPendingDeleteRef.value = [];
  }
});

// Sessions that have scores entered for a test being deleted.
const scoredSessionCountRef = computed(() => {
  const pendingIdSet = new Set(testListPendingDeleteRef.value.map(test => test.id));
  return (sessionListRef.value ?? []).filter(session => session.tests.some(testRecord => pendingIdSet.has(testRecord.testVariantId))).length;
});

async function handleConfirmDelete() {
  const testList = testListPendingDeleteRef.value;
  testListPendingDeleteRef.value = [];
  try {
    await deleteTestVariantList(testList.map(test => test.id));
    rowSelectionRef.value = {};
    toast.add({ title: `${pluralize(testList.length, "test")} deleted`, color: "success", icon: "i-lucide-trash-2" });
  } catch (deleteError) {
    console.error("Test delete failed:", deleteError);
    showError("Couldn't delete tests", deleteError instanceof Error ? deleteError.message : undefined);
  }
}
// #endregion

// #region Export
async function handleExport() {
  const testList = testVariantListRef.value ?? [];
  if (testList.length === 0) return;

  try {
    const isSaved = await saveJsonFile(`tests-${new Date().toISOString().slice(0, 10)}.json`, createTestExportList(testList));
    if (isSaved) toast.add({ title: "Tests exported", color: "success", icon: "i-lucide-download" });
  } catch (exportError) {
    console.error("Test export failed:", exportError);
    showError("Couldn't export tests", exportError instanceof Error ? exportError.message : undefined);
  }
}
// #endregion

// #region Import
type MatchAction = "overwrite" | "skip";

const importFileInputRef = useTemplateRef("importFileInputRef");
const isImportingRef = ref(false);
const isImportModalOpenRef = ref(false);
const importEntryListRef = ref<TestImportEntry[]>([]);
const matchActionByRowRef = ref<Record<number, MatchAction>>({});

const matchActionItemList = [
  { label: "Skip", value: "skip" },
  { label: "Overwrite", value: "overwrite" }
];

const newEntryListRef = computed(() => importEntryListRef.value.filter(entry => entry.kind === "new"));
const matchEntryListRef = computed(() => importEntryListRef.value.filter(entry => entry.kind === "match"));
const rejectedEntryListRef = computed(() => importEntryListRef.value.filter(entry => entry.kind === "rejected"));

const overwriteCountRef = computed(() =>
  matchEntryListRef.value.filter(entry => matchActionByRowRef.value[entry.rowNumber] === "overwrite").length);
const importCountRef = computed(() => newEntryListRef.value.length + overwriteCountRef.value);

async function applyImport(entryList: TestImportEntry[], skippedCount: number) {
  const testList = entryList.flatMap(entry => (entry.kind === "rejected" ? [] : [entry.test]));
  const updatedCount = entryList.filter(entry => entry.kind === "match").length;

  try {
    await saveTestVariantList(testList);
  } catch (importError) {
    console.error("Test import failed:", importError);
    showError("Import failed, no changes were saved", importError instanceof Error ? importError.message : undefined);
    return;
  }

  const detailList = [`${testList.length - updatedCount} added`, `${updatedCount} updated`];
  if (skippedCount > 0) detailList.push(`${skippedCount} skipped`);
  toast.add({ title: "Tests imported", description: detailList.join(" · "), color: "success", icon: "i-lucide-circle-check" });
}

async function handleImportFileSelected(fileInputEvent: Event) {
  const fileInput = fileInputEvent.target as HTMLInputElement;
  const selectedFile = fileInput.files?.[0];
  fileInput.value = "";
  if (!selectedFile) return;

  isImportingRef.value = true;
  try {
    const { entryList, issue } = planTestImport(await selectedFile.text(), testVariantListRef.value ?? []);
    if (issue) {
      showError("Couldn't import file", issue);
      return;
    }

    if (entryList.every(entry => entry.kind === "new")) {
      await applyImport(entryList, 0);
      return;
    }

    importEntryListRef.value = entryList;
    matchActionByRowRef.value = Object.fromEntries(entryList.filter(entry => entry.kind === "match").map(entry => [entry.rowNumber, "skip" as MatchAction]));
    isImportModalOpenRef.value = true;
  } catch (importError) {
    console.error("Test import failed:", importError);
    showError("Couldn't read file", importError instanceof Error ? importError.message : undefined);
  } finally {
    isImportingRef.value = false;
  }
}

function setAllMatchActions(action: MatchAction) {
  matchActionByRowRef.value = Object.fromEntries(matchEntryListRef.value.map(entry => [entry.rowNumber, action]));
}

async function handleConfirmImport() {
  const entryList = importEntryListRef.value.filter(entry =>
    entry.kind === "new" || (entry.kind === "match" && matchActionByRowRef.value[entry.rowNumber] === "overwrite"));
  const skippedCount = matchEntryListRef.value.length - overwriteCountRef.value;

  isImportModalOpenRef.value = false;
  await applyImport(entryList, skippedCount);
}
// #endregion

// #region Table
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

function getRowActionItemList(test: TestVariant): DropdownMenuItem[][] {
  return [
    [{ label: "Edit", icon: "i-lucide-pencil", onSelect: () => openEditModal(test) }],
    [{ label: "Delete", icon: "i-lucide-trash-2", color: "error", onSelect: () => { testListPendingDeleteRef.value = [test]; } }]
  ];
}

const columnList: TableColumn<TestVariant>[] = [
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
    enableSorting: false
  }, {
    id: "name",
    accessorFn: test => test.name,
    header: ({ column }) => renderSortableHeader(column, "Test"),
    cell: ({ row }) => h("span", { class: "font-medium text-highlighted" }, row.original.name)
  }, {
    id: "skills",
    accessorFn: test => test.skills.length,
    header: ({ column }) => renderSortableHeader(column, "Skills")
  }, {
    id: "points",
    accessorFn: test => test.skills.reduce((pointSum, skill) => pointSum + skill.maxScore, 0),
    header: ({ column }) => renderSortableHeader(column, "Points")
  }, {
    id: "actions",
    meta: { class: { td: "text-right" } },
    cell: ({ row }) => h(UDropdownMenu, {
      "content": { align: "end" },
      "items": getRowActionItemList(row.original),
      "aria-label": "Test actions"
    }, () => h(UButton, {
      "icon": "i-lucide-ellipsis-vertical",
      "color": "neutral",
      "variant": "ghost",
      "aria-label": "Test actions"
    }))
  }
];
// #endregion
</script>

<template>
  <div class="mx-auto flex w-full max-w-6xl flex-col gap-4 px-3 py-5 sm:gap-6 sm:px-6 sm:py-8">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="min-w-0">
        <h2 class="text-xl font-semibold text-highlighted sm:text-2xl">
          Tests
        </h2>
        <p class="text-sm text-muted">
          The tests you score in sessions. Import or export them as a JSON file.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <UButton
          label="Import"
          icon="i-lucide-upload"
          color="neutral"
          variant="outline"
          :loading="isImportingRef"
          @click="importFileInputRef?.click()"
        />
        <UButton
          label="Export"
          icon="i-lucide-download"
          color="neutral"
          variant="outline"
          :disabled="(testVariantListRef ?? []).length === 0"
          @click="handleExport"
        />
        <UButton
          label="New Test"
          icon="i-lucide-plus"
          @click="openNewTestModal"
        />
      </div>
    </div>

    <input
      ref="importFileInputRef"
      type="file"
      accept=".json,application/json"
      class="hidden"
      @change="handleImportFileSelected"
    >

    <div class="overflow-hidden rounded-lg border border-muted bg-default shadow-xs">
      <div class="w-full divide-y divide-muted">
        <div class="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:px-4">
          <UInput
            v-model="searchQueryRef"
            icon="i-lucide-search"
            placeholder="Search tests..."
            size="sm"
            class="w-full sm:w-64"
          />
        </div>

        <div
          v-if="selectedTestListRef.length > 0"
          class="flex flex-wrap items-center gap-2 bg-elevated/50 px-3 py-2 sm:px-4"
        >
          <span class="me-auto text-sm font-medium">
            {{ selectedTestListRef.length }} selected
          </span>
          <UButton
            :label="`Delete (${selectedTestListRef.length})`"
            icon="i-lucide-trash-2"
            color="error"
            variant="outline"
            size="sm"
            @click="testListPendingDeleteRef = selectedTestListRef"
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
          :data="testVariantListRef ?? []"
          :columns="columnList"
          :get-row-id="(test: TestVariant) => test.id"
          :loading="testVariantListRef === undefined"
          sticky
          :ui="{ td: 'py-2' }"
          class="max-h-[calc(100dvh-22rem)] min-h-64"
        >
          <template #empty>
            <UEmpty
              v-if="(testVariantListRef ?? []).length === 0"
              variant="naked"
              icon="i-lucide-clipboard-list"
              title="No tests yet"
              description="Import your tests from a JSON file, or create them one at a time."
              :actions="[
                { label: 'Import JSON', icon: 'i-lucide-upload', onClick: () => importFileInputRef?.click() },
                { label: 'New test', icon: 'i-lucide-plus', color: 'neutral', variant: 'outline', onClick: openNewTestModal }
              ]"
              class="py-10"
            />
            <UEmpty
              v-else
              variant="naked"
              icon="i-lucide-search-x"
              title="No matching tests"
              description="Try a different search."
              :actions="[{ label: 'Clear search', color: 'neutral', variant: 'outline', onClick: () => { searchQueryRef = ''; } }]"
              class="py-10"
            />
          </template>
        </UTable>

        <div class="px-3 py-3 text-sm text-muted sm:px-4">
          {{ pluralize((testVariantListRef ?? []).length, "test") }}
        </div>
      </div>
    </div>

    <TestFormModal
      v-model:open="isEditModalOpenRef"
      :test="editingTestRef"
    />

    <UModal
      v-model:open="isDeleteModalOpenRef"
      :title="testListPendingDeleteRef.length === 1 ? 'Delete test' : 'Delete tests'"
    >
      <template #body>
        <div class="space-y-3 text-sm">
          <p>
            <template v-if="testListPendingDeleteRef.length === 1">
              Delete <span class="font-medium">{{ testListPendingDeleteRef[0]!.name }}</span>?
            </template>
            <template v-else>
              Delete <span class="font-medium">{{ testListPendingDeleteRef.length }} tests</span>?
            </template>
            It will no longer be available to score in any session. This can't be undone.
          </p>
          <UAlert
            v-if="scoredSessionCountRef > 0"
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            :title="`Scores were entered in ${pluralize(scoredSessionCountRef, 'session')}`"
            description="Those sessions keep their scores and their own copy of the test, but won't follow any later changes to it."
          />
        </div>
      </template>
      <template #footer="{ close }">
        <div class="flex w-full justify-end gap-2">
          <UButton
            type="button"
            label="Cancel"
            color="neutral"
            variant="outline"
            @click="close"
          />
          <UButton
            label="Delete"
            color="error"
            loading-auto
            @click="handleConfirmDelete"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="isImportModalOpenRef"
      title="Review import"
      :ui="{ content: 'sm:max-w-2xl' }"
    >
      <template #body>
        <div class="space-y-5">
          <div class="flex flex-wrap gap-2">
            <UBadge
              color="success"
              variant="subtle"
              icon="i-lucide-plus"
              :label="`${newEntryListRef.length} new`"
            />
            <UBadge
              color="warning"
              variant="subtle"
              icon="i-lucide-clipboard-list"
              :label="`${matchEntryListRef.length} already exist`"
            />
            <UBadge
              v-if="rejectedEntryListRef.length > 0"
              color="error"
              variant="subtle"
              icon="i-lucide-circle-x"
              :label="`${rejectedEntryListRef.length} can't be imported`"
            />
          </div>

          <section v-if="matchEntryListRef.length > 0">
            <div class="mb-2 flex flex-wrap items-center gap-2">
              <h4 class="me-auto text-sm font-medium">
                Tests that already exist
              </h4>
              <UButton
                type="button"
                label="Skip all"
                color="neutral"
                variant="ghost"
                size="xs"
                @click="setAllMatchActions('skip')"
              />
              <UButton
                type="button"
                label="Overwrite all"
                color="neutral"
                variant="ghost"
                size="xs"
                @click="setAllMatchActions('overwrite')"
              />
            </div>
            <ul class="max-h-64 divide-y divide-muted overflow-y-auto rounded-md border border-muted">
              <li
                v-for="entry in matchEntryListRef"
                :key="entry.rowNumber"
                class="flex items-center gap-3 px-3 py-2"
              >
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium">
                    {{ entry.label }}
                  </p>
                  <p class="text-xs text-muted">
                    Row {{ entry.rowNumber }} · matched by {{ entry.kind === "match" ? entry.matchedBy : "" }}
                  </p>
                </div>
                <USelect
                  v-model="matchActionByRowRef[entry.rowNumber]"
                  :items="matchActionItemList"
                  size="sm"
                  class="w-32"
                />
              </li>
            </ul>
          </section>

          <section v-if="rejectedEntryListRef.length > 0">
            <h4 class="mb-2 text-sm font-medium">
              Tests that can't be imported
            </h4>
            <ul class="max-h-48 divide-y divide-muted overflow-y-auto rounded-md border border-muted">
              <li
                v-for="entry in rejectedEntryListRef"
                :key="entry.rowNumber"
                class="px-3 py-2"
              >
                <p class="text-sm font-medium">
                  {{ entry.label }}
                  <span class="text-xs font-normal text-muted">Row {{ entry.rowNumber }}</span>
                </p>
                <p
                  v-for="issue in entry.kind === 'rejected' ? entry.issueList : []"
                  :key="issue"
                  class="text-xs text-error"
                >
                  {{ issue }}
                </p>
              </li>
            </ul>
          </section>

          <ul class="space-y-1.5 border-t border-muted pt-3 text-xs text-muted">
            <li>
              <span class="font-medium text-default">New</span>
              tests and skills without an ID get one generated for them.
            </li>
            <template v-if="matchEntryListRef.length > 0">
              <li>
                <span class="font-medium text-default">Skip</span>
                leaves the test as it is.
              </li>
              <li>
                <span class="font-medium text-default">Overwrite</span>
                replaces the test with the file's version. Sessions that can still change follow it; completed and archived sessions keep their copy.
              </li>
            </template>
          </ul>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            type="button"
            label="Cancel"
            color="neutral"
            variant="outline"
            @click="isImportModalOpenRef = false"
          />
          <UButton
            type="button"
            :label="`Import ${pluralize(importCountRef, 'test')}`"
            :disabled="importCountRef === 0"
            loading-auto
            @click="handleConfirmImport"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
