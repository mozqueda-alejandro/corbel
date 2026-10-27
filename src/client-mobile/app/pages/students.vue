<script setup lang="ts">
import type { DropdownMenuItem, TableColumn } from "@nuxt/ui";
import { h, resolveComponent } from "vue";

import { type Student, StudentStatusEnum } from "~/schemas/student.schema";

const UButton = resolveComponent("UButton");
const UBadge = resolveComponent("UBadge");
const UCheckbox = resolveComponent("UCheckbox");
const UDropdownMenu = resolveComponent("UDropdownMenu");

const toast = useToast();
const { studentListRef, saveStudentList, deleteStudentList } = useStudentRepository();

function showError(title: string, description?: string) {
  toast.add({ title, description, color: "error", icon: "i-lucide-circle-x" });
}

// #region Filters
const ALL_STATUS_FILTER = "All";

const searchQueryRef = ref("");
const statusFilterRef = ref<StudentStatusEnum | typeof ALL_STATUS_FILTER>(ALL_STATUS_FILTER);
const statusFilterOptionList = [ALL_STATUS_FILTER, ...Object.values(StudentStatusEnum)];
const rowSelectionRef = ref<Record<string, boolean>>({});
const sortingRef = ref([{ id: "name", desc: false }]);

const filteredStudentListRef = computed(() => {
  const studentList = studentListRef.value ?? [];
  return statusFilterRef.value === ALL_STATUS_FILTER
    ? studentList
    : studentList.filter(student => student.status === statusFilterRef.value);
});

const selectedStudentListRef = computed(() =>
  filteredStudentListRef.value.filter(student => rowSelectionRef.value[student.id]));
// #endregion

// #region Edit
const isEditModalOpenRef = ref(false);
const editingStudentRef = ref<Student>();

function openNewStudentModal() {
  editingStudentRef.value = undefined;
  isEditModalOpenRef.value = true;
}

function openEditModal(student: Student) {
  editingStudentRef.value = student;
  isEditModalOpenRef.value = true;
}
// #endregion

// #region Delete
const studentListPendingDeleteRef = ref<Student[]>([]);
const isDeleteModalOpenRef = computed({
  get: () => studentListPendingDeleteRef.value.length > 0,
  set: (isOpen) => {
    if (!isOpen) studentListPendingDeleteRef.value = [];
  }
});

async function handleConfirmDelete() {
  const studentList = studentListPendingDeleteRef.value;
  studentListPendingDeleteRef.value = [];
  try {
    await deleteStudentList(studentList.map(student => student.id));
    rowSelectionRef.value = {};
    toast.add({ title: `${studentList.length} ${studentList.length === 1 ? "student" : "students"} deleted`, color: "success", icon: "i-lucide-trash-2" });
  } catch (deleteError) {
    console.error("Student delete failed:", deleteError);
    showError("Couldn't delete students", deleteError instanceof Error ? deleteError.message : undefined);
  }
}
// #endregion

// #region Export
const UTF8_BOM = String.fromCharCode(0xFEFF);
const REPLACEMENT_CHARACTER = String.fromCharCode(0xFFFD);

async function handleExport() {
  const studentList = studentListRef.value ?? [];
  if (studentList.length === 0) return;

  try {
    // The BOM makes Excel read the file as UTF-8, so accented names survive.
    const csvBlob = new Blob([UTF8_BOM, stringifyCsv(createStudentExportRowList(studentList))], { type: "text/csv;charset=utf-8" });
    const fileName = `students-${new Date().toISOString().slice(0, 10)}.csv`;
    const isSaved = await saveFile(fileName, csvBlob, { description: "CSV file", mimeType: "text/csv", extension: ".csv" });
    if (isSaved) toast.add({ title: "Students exported", color: "success", icon: "i-lucide-download" });
  } catch (exportError) {
    console.error("Student export failed:", exportError);
    showError("Couldn't export students", exportError instanceof Error ? exportError.message : undefined);
  }
}
// #endregion

// #region Import
type MatchAction = "overwrite" | "replace" | "skip";

const importFileInputRef = useTemplateRef("importFileInputRef");
const isImportingRef = ref(false);
const isImportModalOpenRef = ref(false);
const importEntryListRef = ref<StudentImportEntry[]>([]);
const matchActionByRowRef = ref<Record<number, MatchAction>>({});

const matchActionItemList = [
  { label: "Skip", value: "skip" },
  { label: "Overwrite", value: "overwrite" },
  { label: "Replace", value: "replace" }
];

const newEntryListRef = computed(() => importEntryListRef.value.filter(entry => entry.kind === "new"));
const matchEntryListRef = computed(() => importEntryListRef.value.filter(entry => entry.kind === "match"));
const rejectedEntryListRef = computed(() => importEntryListRef.value.filter(entry => entry.kind === "rejected"));

const updateCountRef = computed(() =>
  matchEntryListRef.value.filter(entry => matchActionByRowRef.value[entry.rowNumber] !== "skip").length);
const importCountRef = computed(() => newEntryListRef.value.length + updateCountRef.value);

// CSV saved by Excel in a Windows locale isn't UTF-8; fall back so accents don't turn into replacement characters.
async function readFileText(file: File) {
  const buffer = await file.arrayBuffer();
  const utf8Text = new TextDecoder("utf-8").decode(buffer);
  return utf8Text.includes(REPLACEMENT_CHARACTER) ? new TextDecoder("windows-1252").decode(buffer) : utf8Text;
}

async function applyImport(entryList: StudentImportEntry[], skippedCount: number) {
  const studentList = entryList.flatMap((entry) => {
    if (entry.kind === "rejected") return [];
    return [entry.kind === "match" && matchActionByRowRef.value[entry.rowNumber] === "replace" ? entry.replacementStudent : entry.student];
  });
  const updatedCount = entryList.filter(entry => entry.kind === "match").length;

  try {
    await saveStudentList(studentList);
  } catch (importError) {
    console.error("Student import failed:", importError);
    showError("Import failed, no changes were saved", importError instanceof Error ? importError.message : undefined);
    return;
  }

  const addedCount = studentList.length - updatedCount;
  const detailList = [`${addedCount} added`, `${updatedCount} updated`];
  if (skippedCount > 0) detailList.push(`${skippedCount} skipped`);
  toast.add({ title: "Students imported", description: detailList.join(" · "), color: "success", icon: "i-lucide-circle-check" });
}

async function handleImportFileSelected(fileInputEvent: Event) {
  const fileInput = fileInputEvent.target as HTMLInputElement;
  const selectedFile = fileInput.files?.[0];
  fileInput.value = "";
  if (!selectedFile) return;

  isImportingRef.value = true;
  try {
    const { rowList, issue } = parseStudentCsv(parseCsv(await readFileText(selectedFile)));
    if (issue) {
      showError("Couldn't import file", issue);
      return;
    }
    if (rowList.length === 0) {
      showError("Couldn't import file", "The file has no student rows.");
      return;
    }

    const entryList = planStudentImport(rowList, studentListRef.value ?? []);
    const hasMatchOrRejection = entryList.some(entry => entry.kind !== "new");
    if (!hasMatchOrRejection) {
      await applyImport(entryList, 0);
      return;
    }

    importEntryListRef.value = entryList;
    matchActionByRowRef.value = Object.fromEntries(entryList.filter(entry => entry.kind === "match").map(entry => [entry.rowNumber, "skip" as MatchAction]));
    isImportModalOpenRef.value = true;
  } catch (importError) {
    console.error("Student import failed:", importError);
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
    entry.kind === "new" || (entry.kind === "match" && matchActionByRowRef.value[entry.rowNumber] !== "skip"));
  const skippedCount = matchEntryListRef.value.length - updateCountRef.value;

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

function renderContactLink(href: string, text: string) {
  return h("a", { href, class: "hover:underline" }, text);
}

function getRowActionItemList(student: Student): DropdownMenuItem[][] {
  return [
    [{ label: "Edit", icon: "i-lucide-pencil", onSelect: () => openEditModal(student) }],
    [{ label: "Delete", icon: "i-lucide-trash-2", color: "error", onSelect: () => { studentListPendingDeleteRef.value = [student]; } }]
  ];
}

const columnList: TableColumn<Student>[] = [
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
    accessorFn: student => `${student.lastName} ${student.firstName} ${student.preferredName ?? ""}`,
    header: ({ column }) => renderSortableHeader(column, "Student"),
    cell: ({ row }) => h("div", [
      h("div", { class: "font-medium text-highlighted" }, getStudentFullName(row.original)),
      row.original.preferredName ? h("div", { class: "text-xs text-muted" }, `"${row.original.preferredName}"`) : undefined
    ])
  }, {
    id: "email",
    accessorFn: student => student.email ?? "",
    header: ({ column }) => renderSortableHeader(column, "Email"),
    cell: ({ row }) => row.original.email
      ? renderContactLink(`mailto:${row.original.email}`, row.original.email)
      : h("span", { class: "text-muted" }, "—")
  }, {
    id: "phone",
    // Includes the raw number so a search for digits matches however the number is formatted.
    accessorFn: student => `${formatPhoneNumber(student.phoneNumber)} ${student.phoneNumber ?? ""}`,
    header: ({ column }) => renderSortableHeader(column, "Phone"),
    cell: ({ row }) => row.original.phoneNumber
      ? renderContactLink(`tel:${row.original.phoneNumber}`, formatPhoneNumber(row.original.phoneNumber))
      : h("span", { class: "text-muted" }, "—")
  }, {
    accessorKey: "status",
    header: ({ column }) => renderSortableHeader(column, "Status"),
    cell: ({ row }) => h(UBadge, { variant: "subtle", color: studentStatusColorMap[row.original.status] }, () => row.original.status)
  }, {
    accessorKey: "year",
    header: ({ column }) => renderSortableHeader(column, "Year")
  }, {
    id: "actions",
    meta: { class: { td: "text-right" } },
    cell: ({ row }) => h(UDropdownMenu, {
      "content": { align: "end" },
      "items": getRowActionItemList(row.original),
      "aria-label": "Student actions"
    }, () => h(UButton, {
      "icon": "i-lucide-ellipsis-vertical",
      "color": "neutral",
      "variant": "ghost",
      "aria-label": "Student actions"
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
          Students
        </h2>
        <p class="text-sm text-muted">
          Contact information for your roster. Import or export it as a CSV file.
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
          :disabled="(studentListRef ?? []).length === 0"
          @click="handleExport"
        />
        <UButton
          label="New Student"
          icon="i-lucide-user-round-plus"
          @click="openNewStudentModal"
        />
      </div>
    </div>

    <input
      ref="importFileInputRef"
      type="file"
      accept=".csv,text/csv"
      class="hidden"
      @change="handleImportFileSelected"
    >

    <div class="overflow-hidden rounded-lg border border-muted bg-default shadow-xs">
      <div class="w-full divide-y divide-muted">
        <div class="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:px-4">
          <UInput
            v-model="searchQueryRef"
            icon="i-lucide-search"
            placeholder="Search students..."
            size="sm"
            class="w-full sm:w-64"
          />
          <USelect
            v-model="statusFilterRef"
            :items="statusFilterOptionList"
            size="sm"
            class="w-full sm:w-40"
          />
        </div>

        <div
          v-if="selectedStudentListRef.length > 0"
          class="flex flex-wrap items-center gap-2 bg-elevated/50 px-3 py-2 sm:px-4"
        >
          <span class="me-auto text-sm font-medium">
            {{ selectedStudentListRef.length }} selected
          </span>
          <UButton
            :label="`Delete (${selectedStudentListRef.length})`"
            icon="i-lucide-trash-2"
            color="error"
            variant="outline"
            size="sm"
            @click="studentListPendingDeleteRef = selectedStudentListRef"
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
          :data="filteredStudentListRef"
          :columns="columnList"
          :get-row-id="(student: Student) => student.id"
          :loading="studentListRef === undefined"
          sticky
          :ui="{ td: 'py-2' }"
          class="max-h-[calc(100dvh-22rem)] min-h-64"
        >
          <template #empty>
            <UEmpty
              v-if="(studentListRef ?? []).length === 0"
              variant="naked"
              icon="i-lucide-users-round"
              title="No students yet"
              description="Import your roster from a CSV file (an ID column isn't needed), or add students one at a time."
              :actions="[
                { label: 'Import CSV', icon: 'i-lucide-upload', onClick: () => importFileInputRef?.click() },
                { label: 'Add student', icon: 'i-lucide-user-round-plus', color: 'neutral', variant: 'outline', onClick: openNewStudentModal }
              ]"
              class="py-10"
            />
            <UEmpty
              v-else
              variant="naked"
              icon="i-lucide-user-round-search"
              title="No matching students"
              description="Try a different search or status filter."
              :actions="[{ label: 'Clear filters', color: 'neutral', variant: 'outline', onClick: () => { searchQueryRef = ''; statusFilterRef = ALL_STATUS_FILTER; } }]"
              class="py-10"
            />
          </template>
        </UTable>

        <div class="px-3 py-3 text-sm text-muted sm:px-4">
          {{ filteredStudentListRef.length }} {{ filteredStudentListRef.length === 1 ? "student" : "students" }}
        </div>
      </div>
    </div>

    <StudentFormModal
      v-model:open="isEditModalOpenRef"
      :student="editingStudentRef"
    />

    <UModal
      v-model:open="isDeleteModalOpenRef"
      :title="studentListPendingDeleteRef.length === 1 ? 'Delete student' : 'Delete students'"
    >
      <template #body>
        <p class="text-sm">
          <template v-if="studentListPendingDeleteRef.length === 1">
            Delete <span class="font-medium">{{ getStudentFullName(studentListPendingDeleteRef[0]!) }}</span>?
          </template>
          <template v-else>
            Delete <span class="font-medium">{{ studentListPendingDeleteRef.length }} students</span>?
          </template>
          Existing sessions keep their saved attendance and scores. This can't be undone.
        </p>
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
              icon="i-lucide-user-round-plus"
              :label="`${newEntryListRef.length} new`"
            />
            <UBadge
              color="warning"
              variant="subtle"
              icon="i-lucide-users-round"
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
                Students that already exist
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
              <UButton
                type="button"
                label="Replace all"
                color="neutral"
                variant="ghost"
                size="xs"
                @click="setAllMatchActions('replace')"
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
              Rows that can't be imported
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
            <li v-if="newEntryListRef.length > 0">
              <span class="font-medium text-default">New</span>
              students get an ID generated for them, so the file doesn't need an ID column.
            </li>
            <template v-if="matchEntryListRef.length > 0">
              <li>
                <span class="font-medium text-default">Skip</span>
                leaves the student as they are.
              </li>
              <li>
                <span class="font-medium text-default">Overwrite</span>
                updates the student with the file's details. Blank cells keep the current value.
              </li>
              <li>
                <span class="font-medium text-default">Replace</span>
                discards the old details, so blank cells are cleared and status and year reset to Active and 0. Session history is kept.
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
            :label="`Import ${importCountRef} ${importCountRef === 1 ? 'student' : 'students'}`"
            :disabled="importCountRef === 0"
            loading-auto
            @click="handleConfirmImport"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
