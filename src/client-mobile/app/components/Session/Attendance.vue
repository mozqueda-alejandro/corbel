<script setup lang="ts">
import { CalendarDate, type DateValue } from "@internationalized/date";
import type { TableColumn } from "@nuxt/ui";
import { useDebounceFn, useLocalStorage } from "@vueuse/core";
import { z } from "zod";

import type { Session } from "~/schemas/session.schema";
import { AttendanceStatusEnum, sessionSchema } from "~/schemas/session.schema";
import { type SessionStudent, type Student, StudentStatusEnum } from "~/schemas/student.schema";

//region Types and Constants
const UButton = resolveComponent("UButton");
const UBadge = resolveComponent("UBadge");

// Status isn't editable here; it's driven by exporting, completing and archiving.
const sessionDetailsSchema = sessionSchema.pick({ name: true, overview: true }).extend({ date: z.date() });
type SessionDetails = z.infer<typeof sessionDetailsSchema>;

type SortableColumn = {
  getIsSorted: () => false | "asc" | "desc"
  toggleSorting: (desc?: boolean) => void
  clearSorting: () => void
};

const attendanceStatusOptionList: AttendanceStatusEnum[] = Object.values(AttendanceStatusEnum);
const studentStatusFilterOptionList: StudentStatusEnum[] = Object.values(StudentStatusEnum);

const attendanceStatusColorMap: Record<AttendanceStatusEnum, "success" | "warning" | "error"> = {
  Present: "success",
  Tardy: "warning",
  Absent: "error"
};

const attendanceStatusSortMap: Record<AttendanceStatusEnum, number> = {
  Present: 0,
  Tardy: 1,
  Absent: 2
};

const attendanceStatusIconMap: Record<AttendanceStatusEnum, "check" | "clock" | "x"> = {
  Present: "check",
  Tardy: "clock",
  Absent: "x"
};

//endregion

//region Props and Composables
// readonly is set for completed and archived sessions.
const props = defineProps<{
  session: Session
  readonly?: boolean
}>();

const toast = useToast();
const { studentListRef } = useStudentRepository();
const { sessionStudentListRef, isRosterFrozenRef } = useSessionStudentList(() => props.session);
const { sessionListRef, saveSessionEdit } = useSessionRepository();
const { importOnboardingDataFromJson } = useOnboardingImport();
const { minCalendarDate, maxCalendarDate } = getSessionDateBounds();
//endregion

//region Session Details
const sessionDetailsStateRef = reactive<SessionDetails>(getSessionDetails(props.session));
const isSessionPanelOpenRef = useLocalStorage("attendance-session-panel-open", true);

const formattedSessionDateRef = computed(() =>
  sessionDetailsStateRef.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }));

const lastModifiedTextRef = computed(() => {
  if (!props.session.lastModifiedAt) return "";
  const modifiedAt = new Date(props.session.lastModifiedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return `Modified ${modifiedAt}`;
});

function getSessionDetails(session: Session): SessionDetails {
  return {
    name: session.name,
    overview: session.overview ?? "",
    date: new Date(session.date)
  };
}
//endregion

//region Session Calendar
// Uses the in-progress date for the current session so the calendar reflects unsaved edits.
const sessionListByDayKeyRef = computed(() => {
  const sessionListByDayKey = new Map<string, Session[]>();
  const sessionList = (sessionListRef.value ?? []).map(sessionItem =>
    sessionItem.id === props.session.id ? { ...sessionItem, date: sessionDetailsStateRef.date } : sessionItem);

  for (const sessionItem of sessionList) {
    const dayKey = toDateDayKey(new Date(sessionItem.date));
    sessionListByDayKey.set(dayKey, [...(sessionListByDayKey.get(dayKey) ?? []), sessionItem]);
  }
  return sessionListByDayKey;
});

// Selecting a day with another session opens it; the current session's date is edited in the form.
const calendarValueRef = computed<DateValue | undefined>({
  get: () => {
    const sessionDate = sessionDetailsStateRef.date;
    return new CalendarDate(sessionDate.getFullYear(), sessionDate.getMonth() + 1, sessionDate.getDate());
  },
  set: (selectedDay) => {
    if (!selectedDay) return;
    const otherSession = getSessionListForDay(selectedDay).find(sessionItem => sessionItem.id !== props.session.id);
    if (otherSession) navigateTo({ path: `/sessions/${otherSession.id}`, query: { tab: "attendance" } });
  }
});

function toDayKey(year: number, month: number, day: number): string {
  return `${year}-${month}-${day}`;
}

function toDateDayKey(date: Date): string {
  return toDayKey(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function getSessionListForDay(day: DateValue): Session[] {
  return sessionListByDayKeyRef.value.get(toDayKey(day.year, day.month, day.day)) ?? [];
}

function getDayChipColor(day: DateValue) {
  const sessionListForDay = getSessionListForDay(day);
  if (sessionListForDay.some(sessionItem => sessionItem.id === props.session.id)) return "primary";
  return sessionListForDay[0] ? sessionStatusColorMap[sessionListForDay[0].status] : "neutral";
}
//endregion

//region Students
const studentStatusFilterRef = ref<StudentStatusEnum>(StudentStatusEnum.Active);

// A frozen roster is shown in full; otherwise the live roster is filtered by status.
const filteredStudentListRef = computed(() => {
  const sessionStudentList = sessionStudentListRef.value ?? [];
  if (isRosterFrozenRef.value) return sessionStudentList;

  return sessionStudentList.filter(studentItem => studentItem.status === studentStatusFilterRef.value);
});

const hasAnyStudentsRef = computed(() => (sessionStudentListRef.value?.length ?? 0) > 0);

function getTotalSessionsForStudent(_studentId: string): number {
  // TODO: replace with real aggregation once session history querying is wired up.
  return 0;
}
//endregion

//region Attendance
const attendanceByStudentIdRef = ref<Map<string, AttendanceStatusEnum>>(getAttendanceMap(props.session));

const attendanceSummaryRef = computed(() => {
  const summary: Record<AttendanceStatusEnum | "Unmarked", number> = { Present: 0, Tardy: 0, Absent: 0, Unmarked: 0 };
  for (const studentItem of filteredStudentListRef.value) {
    summary[getAttendanceStatus(studentItem.id) ?? "Unmarked"]++;
  }
  return summary;
});

// Built in the script so the status is typed here instead of relying on v-for inference in the template.
const attendanceSummaryBadgeListRef = computed(() =>
  attendanceStatusOptionList.map((status: AttendanceStatusEnum) => ({
    status,
    color: attendanceStatusColorMap[status],
    icon: `i-lucide-${attendanceStatusIconMap[status]}`,
    label: String(attendanceSummaryRef.value[status])
  })));

function getAttendanceMap(session: Session) {
  return new Map(session.attendance.map(attendanceRecord => [attendanceRecord.studentId, attendanceRecord.status]));
}

function getAttendanceStatus(studentId: string): AttendanceStatusEnum | undefined {
  return attendanceByStudentIdRef.value.get(studentId);
}

function setAttendanceStatus(studentId: string, status: AttendanceStatusEnum) {
  if (props.readonly) return;
  if (attendanceByStudentIdRef.value.get(studentId) === status) {
    attendanceByStudentIdRef.value.delete(studentId);
  } else {
    attendanceByStudentIdRef.value.set(studentId, status);
  }
  attendanceByStudentIdRef.value = new Map(attendanceByStudentIdRef.value);
  persistSession();
}

function markAllPresent() {
  if (props.readonly) return;
  const updatedAttendanceMap = new Map(attendanceByStudentIdRef.value);
  for (const studentItem of filteredStudentListRef.value) {
    updatedAttendanceMap.set(studentItem.id, AttendanceStatusEnum.Present);
  }
  attendanceByStudentIdRef.value = updatedAttendanceMap;
  persistSession();
}
//endregion

//region Session Persistence
// Details and attendance are saved together so neither overwrites the other with stale data.
// The repository only writes (and moves an exported session back to drafting) when content actually changed.
async function saveSessionDetails() {
  if (props.readonly) return;

  const detailsResult = sessionDetailsSchema.safeParse(sessionDetailsStateRef);
  if (!detailsResult.success) return;

  try {
    await saveSessionEdit(props.session.id, {
      ...detailsResult.data,
      attendance: Array.from(attendanceByStudentIdRef.value.entries()).map(([studentId, status]) => ({ studentId, status }))
    });
  } catch (saveError) {
    console.error("Session save failed:", saveError);
    toast.add({
      title: "Couldn't save session",
      description: saveError instanceof Error ? saveError.message : undefined,
      color: "error",
      icon: "i-lucide-circle-x"
    });
  }
}

const persistSession = useDebounceFn(saveSessionDetails, 400);

watch(sessionDetailsStateRef, () => persistSession(), { deep: true });

watch(() => props.session.id, () => {
  attendanceByStudentIdRef.value = getAttendanceMap(props.session);
  Object.assign(sessionDetailsStateRef, getSessionDetails(props.session));
});

// Lets the page save pending edits before changing the session's status.
defineExpose({ flushPendingEdits: saveSessionDetails });
//endregion

//region Roster Import
const isImportingRef = ref(false);
const importFileInputRef = ref<HTMLInputElement>();

function triggerImportFilePicker() {
  importFileInputRef.value?.click();
}

async function handleImportFileSelected(fileInputEvent: Event) {
  const fileInput = fileInputEvent.target as HTMLInputElement;
  const selectedFile = fileInput.files?.[0];
  if (!selectedFile) return;

  isImportingRef.value = true;
  const { issueList } = await importOnboardingDataFromJson(selectedFile);
  isImportingRef.value = false;
  fileInput.value = "";

  if (issueList.length > 0) {
    console.error("Student import failed:", issueList);
    toast.add({ title: "Import failed", description: issueList[0], color: "error", icon: "i-lucide-circle-x" });
    return;
  }
  toast.add({ title: "Roster imported", color: "success", icon: "i-lucide-circle-check" });
}
//endregion

//region Student Modals
const isEditModalOpenRef = ref(false);
const editingStudentRef = ref<Student>();

const isContactModalOpenRef = ref(false);
const contactStudentRef = ref<(SessionStudent & Partial<Pick<Student, "email" | "phoneNumber">>) | null>(null);

// The edit form works on the live record; a roster entry is only the session's view of it.
function openEditModal(student: SessionStudent) {
  const liveStudent = studentListRef.value?.find(studentItem => studentItem.id === student.id);
  if (!liveStudent) return;
  editingStudentRef.value = liveStudent;
  isEditModalOpenRef.value = true;
}

function openNewStudentModal() {
  editingStudentRef.value = undefined;
  isEditModalOpenRef.value = true;
}

// Contact details aren't kept in a roster entry, so they come from the live record when it still exists.
function openContactModal(student: SessionStudent) {
  const liveStudent = studentListRef.value?.find(studentItem => studentItem.id === student.id);
  contactStudentRef.value = { ...liveStudent, ...student };
  isContactModalOpenRef.value = true;
}
//endregion

//region Table
const sortingRef = ref([{ id: "name", desc: false }]);

// Cycles none -> asc -> desc -> none.
function cycleSorting(column: SortableColumn) {
  const isSorted = column.getIsSorted();
  if (!isSorted) column.toggleSorting(false);
  else if (isSorted === "asc") column.toggleSorting(true);
  else column.clearSorting();
}

function renderSortableHeader(column: SortableColumn, label: string) {
  const isSorted = column.getIsSorted();
  return h(UButton, {
    color: "neutral",
    variant: "ghost",
    label,
    icon: isSorted ? (isSorted === "asc" ? "i-lucide-arrow-up-narrow-wide" : "i-lucide-arrow-down-wide-narrow") : "i-lucide-arrow-up-down",
    class: "-mx-2.5",
    onClick: () => cycleSorting(column)
  });
}

const tableColumnList: TableColumn<SessionStudent>[] = [
  {
    id: "name",
    accessorFn: student => getStudentFullName(student),
    meta: { class: { th: "w-[30%]", td: "w-[30%]" } },
    header: ({ column }) => renderSortableHeader(column, "Student"),
    cell: ({ row }) => {
      const fullName = getStudentFullName(row.original);
      const { preferredName } = row.original;
      // Two 16px lines fill the 32px the row's buttons already need, so a stacked preferred name never makes
      // the row taller; a long name is clamped rather than growing it.
      return h("div", { class: "flex h-8 flex-col justify-center break-words", title: fullName }, [
        h("div", { class: `${preferredName ? "line-clamp-1" : "line-clamp-2"} leading-4` }, fullName),
        preferredName ? h("div", { class: "line-clamp-1 text-xs text-muted" }, `"${preferredName}"`) : undefined
      ]);
    }
  },
  {
    id: "attendance",
    accessorFn: student => getAttendanceStatus(student.id),
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const statusA = getAttendanceStatus(rowA.original.id);
      const statusB = getAttendanceStatus(rowB.original.id);

      const sortA = statusA === undefined ? Number.MAX_SAFE_INTEGER : attendanceStatusSortMap[statusA];
      const sortB = statusB === undefined ? Number.MAX_SAFE_INTEGER : attendanceStatusSortMap[statusB];

      return sortA - sortB;
    },
    meta: { class: { th: "w-[40%]", td: "w-[40%]" } },
    header: ({ column }) => renderSortableHeader(column, "Attendance"),
    cell: ({ row }) => {
      const currentStatus = getAttendanceStatus(row.original.id);
      return h(
        "div",
        { class: "flex gap-2" },
        attendanceStatusOptionList.map(statusOption =>
          h(UButton, {
            key: statusOption,
            label: statusOption,
            size: "sm",
            class: "w-24 justify-center",
            color: currentStatus === statusOption ? attendanceStatusColorMap[statusOption] : "neutral",
            icon: `i-lucide-${attendanceStatusIconMap[statusOption]}`,
            variant: currentStatus === statusOption ? "solid" : "soft",
            disabled: props.readonly,
            onClick: () => setAttendanceStatus(row.original.id, statusOption)
          }))
      );
    }
  },
  {
    id: "totalSessions",
    header: "# Sessions",
    enableSorting: false,
    meta: { class: { th: "w-[10%] whitespace-nowrap", td: "w-[10%]" } },
    cell: ({ row }) => getTotalSessionsForStudent(row.original.id)
  },
  {
    id: "status",
    header: "Status",
    enableSorting: false,
    meta: { class: { th: "w-[10%]", td: "w-[10%]" } },
    cell: ({ row }) =>
      h(UBadge, { variant: "subtle", color: studentStatusColorMap[row.original.status] }, () => row.original.status)
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    meta: { class: { th: "w-[10%]", td: "w-[10%]" } },
    cell: ({ row }) =>
      h("div", { class: "flex gap-2 justify-end" }, [
        h(UButton, {
          icon: "i-lucide-pencil",
          color: "neutral",
          variant: "ghost",
          size: "sm",
          class: "w-8 justify-center",
          disabled: props.readonly,
          onClick: () => openEditModal(row.original)
        }),
        h(UButton, {
          icon: "i-lucide-info",
          color: "neutral",
          variant: "ghost",
          size: "sm",
          class: "w-8 justify-center",
          onClick: () => openContactModal(row.original)
        })
      ])
  }
];
//endregion
</script>

<template>
  <div class="space-y-3 px-3 sm:px-4">
    <UCollapsible
      v-model:open="isSessionPanelOpenRef"
      class="border border-muted rounded-md overflow-hidden"
    >
      <template #default="{ open }">
        <button
          type="button"
          class="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-elevated/50 transition-colors"
        >
          <div class="min-w-0 flex-1">
            <p class="truncate font-medium">
              {{ sessionDetailsStateRef.name || "Untitled session" }}
            </p>
            <p class="text-xs text-muted">
              {{ formattedSessionDateRef }}
            </p>
          </div>
          <div
            v-if="lastModifiedTextRef"
            class="shrink-0 text-right text-xs text-muted"
          >
            <p>{{ lastModifiedTextRef }}</p>
            <p v-if="session.lastModifiedBy">
              by {{ session.lastModifiedBy }}
            </p>
          </div>
          <UIcon
            name="i-lucide-chevron-down"
            class="size-5 shrink-0 text-muted transition-transform duration-200"
            :class="{ 'rotate-180': open }"
          />
        </button>
      </template>

      <template #content>
        <div class="grid gap-4 border-t border-muted p-4 md:grid-cols-[auto_1fr]">
          <div class="flex flex-col items-center gap-2">
            <UCalendar
              v-model="calendarValueRef"
              size="sm"
              :min-value="minCalendarDate"
              :max-value="maxCalendarDate"
            >
              <template #day="{ day }">
                <UChip
                  :show="getSessionListForDay(day).length > 0"
                  :color="getDayChipColor(day)"
                  size="2xs"
                >
                  {{ day.day }}
                </UChip>
              </template>
            </UCalendar>
            <p class="text-xs text-muted">
              Tap a marked day to open that session.
            </p>
          </div>

          <UForm
            :schema="sessionDetailsSchema"
            :state="sessionDetailsStateRef"
            :validate-on="['input', 'change', 'blur']"
            :disabled="readonly"
            class="space-y-3"
          >
            <UFormField
              label="Name"
              name="name"
            >
              <UInput
                v-model="sessionDetailsStateRef.name"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Date"
              name="date"
            >
              <InputDate
                v-model="sessionDetailsStateRef.date"
                :min-value="minCalendarDate"
                :max-value="maxCalendarDate"
                :disabled="readonly"
                popover-side="bottom"
                popover-align="end"
                :popover-side-offset="8"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Overview"
              name="overview"
              :hint="`${sessionDetailsStateRef.overview?.length ?? 0}/200`"
            >
              <UTextarea
                v-model="sessionDetailsStateRef.overview"
                :rows="2"
                :maxlength="200"
                autoresize
                placeholder="What's this session about?"
                class="w-full"
              />
            </UFormField>
          </UForm>
        </div>
      </template>
    </UCollapsible>

    <div class="border border-muted rounded-md overflow-hidden">
      <div class="flex items-center gap-2 px-4 py-3.5 overflow-x-auto border-b border-accented">
        <UButton
          color="neutral"
          label="New Student"
          icon="i-lucide-user-round-plus"
          :disabled="readonly || isRosterFrozenRef"
          @click="openNewStudentModal"
        />
        <USelect
          v-if="!isRosterFrozenRef"
          v-model="studentStatusFilterRef"
          :items="studentStatusFilterOptionList"
        />
        <UButton
          icon="i-lucide-check-check"
          color="neutral"
          variant="outline"
          size="sm"
          :disabled="readonly || filteredStudentListRef.length === 0"
          @click="markAllPresent"
        >
          Mark all present
        </UButton>
      </div>

      <UTable
        v-model:sorting="sortingRef"
        :data="filteredStudentListRef"
        :columns="tableColumnList"
        :loading="studentListRef === undefined"
        sticky="header"
        :ui="{ td: 'py-2' }"
        class="max-h-[60vh]"
      >
        <template #empty>
          <UEmpty
            v-if="!hasAnyStudentsRef"
            variant="naked"
            icon="i-lucide-users-round"
            title="No students yet"
            :description="readonly || isRosterFrozenRef ? 'Your roster is empty.' : 'Import your roster to start taking attendance, or add students one at a time.'"
            :actions="readonly || isRosterFrozenRef ? [] : [
              { label: 'Import roster', icon: 'i-lucide-upload', loading: isImportingRef, onClick: triggerImportFilePicker },
              { label: 'Add student', icon: 'i-lucide-user-round-plus', color: 'neutral', variant: 'outline', onClick: openNewStudentModal }
            ]"
            class="py-10"
          />
          <UEmpty
            v-else
            variant="naked"
            icon="i-lucide-user-round-search"
            :title="`No ${studentStatusFilterRef.toLowerCase()} students`"
            description="Try a different status filter to see more of your roster."
            :actions="[
              { label: 'Show active students', color: 'neutral', variant: 'outline', onClick: () => (studentStatusFilterRef = StudentStatusEnum.Active) }
            ]"
            class="py-10"
          />
        </template>
      </UTable>

      <div
        v-if="filteredStudentListRef.length > 0"
        class="flex flex-wrap items-center gap-2 border-t border-accented px-4 py-2.5 text-sm"
      >
        <span class="text-muted me-auto">
          {{ filteredStudentListRef.length }} {{ filteredStudentListRef.length === 1 ? "student" : "students" }}
        </span>
        <UBadge
          v-for="summaryBadge in attendanceSummaryBadgeListRef"
          :key="summaryBadge.status"
          variant="subtle"
          :color="summaryBadge.color"
          :icon="summaryBadge.icon"
          :label="summaryBadge.label"
        />
        <UBadge
          variant="subtle"
          color="neutral"
          icon="i-lucide-circle-dashed"
          :label="`${attendanceSummaryRef.Unmarked} unmarked`"
        />
      </div>
    </div>

    <input
      ref="importFileInputRef"
      type="file"
      accept="application/json"
      class="hidden"
      @change="handleImportFileSelected"
    >

    <StudentFormModal
      v-model:open="isEditModalOpenRef"
      :student="editingStudentRef"
      :default-status="studentStatusFilterRef"
    />

    <UModal
      v-model:open="isContactModalOpenRef"
      :overlay="false"
      title="Contact Information"
    >
      <template #body>
        <div class="space-y-3 text-sm">
          <div>
            <p class="text-xs text-muted uppercase tracking-wide">
              Name
            </p>
            <p>{{ contactStudentRef?.firstName }} {{ contactStudentRef?.lastName }}</p>
          </div>
          <div>
            <p class="text-xs text-muted uppercase tracking-wide">
              Preferred name
            </p>
            <p>{{ contactStudentRef?.preferredName || "Not provided" }}</p>
          </div>
          <div>
            <p class="text-xs text-muted uppercase tracking-wide">
              Email
            </p>
            <p>{{ contactStudentRef?.email || "Not provided" }}</p>
          </div>
          <div>
            <p class="text-xs text-muted uppercase tracking-wide">
              Phone
            </p>
            <p>{{ contactStudentRef?.phoneNumber || "Not provided" }}</p>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
