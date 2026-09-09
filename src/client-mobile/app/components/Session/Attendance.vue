<script setup lang="ts">
import type { TableColumn } from "@nuxt/ui";
import { useDebounceFn } from "@vueuse/core";
import { h, resolveComponent } from "vue";

import type { Session } from "~/schemas/session.schema";
import { AttendanceStatusEnum } from "~/schemas/session.schema";
import type { Student } from "~/schemas/student.schema";

const UCheckbox = resolveComponent("UCheckbox");
const UButton = resolveComponent("UButton");
const UButtonGroup = resolveComponent("UButtonGroup");
const UBadge = resolveComponent("UBadge");

const props = defineProps<{
  session: Session
}>();

console.log(props.session);

const { studentListRef } = useStudentRepository();
const { saveSession } = useSessionRepository();

const openSlideover = ref(false);

const activeStudentListRef = computed(() =>
  studentListRef.value.filter(studentItem => studentItem.status === "Active"));

const attendanceByStudentIdRef = ref<Map<string, AttendanceStatusEnum>>(new Map(props.session.attendance.map(attendanceRecord => [attendanceRecord.studentId, attendanceRecord.status])));

watch(() => props.session.id, () => {
  attendanceByStudentIdRef.value = new Map(props.session.attendance.map(attendanceRecord => [attendanceRecord.studentId, attendanceRecord.status]));
});

function getAttendanceStatus(studentId: string): AttendanceStatusEnum | undefined {
  return attendanceByStudentIdRef.value.get(studentId);
}

function setAttendanceStatus(studentId: string, status: AttendanceStatusEnum) {
  if (attendanceByStudentIdRef.value.get(studentId) === status) {
    attendanceByStudentIdRef.value.delete(studentId);
  } else {
    attendanceByStudentIdRef.value.set(studentId, status);
  }
  attendanceByStudentIdRef.value = new Map(attendanceByStudentIdRef.value);
  persistAttendance();
}

function markAllPresent() {
  attendanceByStudentIdRef.value = new Map(activeStudentListRef.value.map(studentItem => [studentItem.id, "Present" as AttendanceStatusEnum]));
  persistAttendance();
}

const persistAttendance = useDebounceFn(async () => {
  await saveSession({
    ...props.session,
    attendance: Array.from(attendanceByStudentIdRef.value.entries()).map(([studentId, status]) => ({ studentId, status }))
  });
}, 400);

const attendanceStatusOptionList = Object.values(AttendanceStatusEnum);

const attendanceStatusColorMap: Record<AttendanceStatusEnum, "success" | "warning" | "error"> = {
  Present: "success",
  Tardy: "warning",
  Absent: "error"
};

const rowSelectionRef = ref<Record<string, boolean>>({});

const tableColumnList: TableColumn<Student>[] = [
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
  },
  {
    accessorKey: "lastName",
    header: ({ column }) => {
      const isSorted = column.getIsSorted();
      return h(UButton, {
        color: "neutral",
        variant: "ghost",
        label: "Student",
        icon: isSorted ? (isSorted === "asc" ? "i-lucide-arrow-up-narrow-wide" : "i-lucide-arrow-down-wide-narrow") : "i-lucide-arrow-up-down",
        class: "-mx-2.5",
        onClick: () => column.toggleSorting(column.getIsSorted() === "asc")
      });
    },
    cell: ({ row }) => `${row.original.firstName} ${row.original.lastName}`
  },
  {
    id: "attendance",
    header: "Attendance",
    enableSorting: false,
    cell: ({ row }) => {
      const currentStatus = getAttendanceStatus(row.original.id);
      return h(UButtonGroup, { size: "sm" }, () =>
        attendanceStatusOptionList.map(statusOption =>
          h(UButton, {
            key: statusOption,
            label: statusOption,
            color: currentStatus === statusOption ? attendanceStatusColorMap[statusOption] : "neutral",
            variant: currentStatus === statusOption ? "solid" : "outline",
            onClick: () => setAttendanceStatus(row.original.id, statusOption)
          })));
    }
  },
  {
    id: "statusBadge",
    header: "Marked",
    enableSorting: false,
    cell: ({ row }) => {
      const currentStatus = getAttendanceStatus(row.original.id);
      if (!currentStatus) {
        return h(UBadge, { variant: "subtle", color: "neutral" }, () => "Unmarked");
      }
      return h(UBadge, { variant: "subtle", color: attendanceStatusColorMap[currentStatus] }, () => currentStatus);
    }
  }
];
</script>

<template>
  <div class="space-y-3">
    <div class="flex justify-end">
      <UButton
        icon="i-lucide-check-check"
        color="neutral"
        variant="outline"
        size="sm"
        @click="markAllPresent"
      >
        Mark all present
      </UButton>
    </div>

    <UTable
      v-model:row-selection="rowSelectionRef"
      :data="activeStudentListRef"
      :columns="tableColumnList"
    />

    <UButton @click="openSlideover = true">
      Notes
    </UButton>
    <SessionNotesSlideover
      v-model:open="openSlideover"
      :session-id="session.id"
    />
  </div>
</template>
