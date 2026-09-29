<script setup lang="ts">
import type { TableColumn } from "@nuxt/ui";
import { useDebounceFn } from "@vueuse/core";
import { h, reactive, ref, resolveComponent } from "vue";

import type { Session } from "~/schemas/session.schema";
import { AttendanceStatusEnum } from "~/schemas/session.schema";
import { type Student, StudentStatusEnum } from "~/schemas/student.schema";

const UButton = resolveComponent("UButton");
const UBadge = resolveComponent("UBadge");

const props = defineProps<{
  session: Session
}>();

const { studentListRef, saveStudent } = useStudentRepository();
const { saveSession } = useSessionRepository();

const activeStudentListRef = computed(() => {
  if (!studentListRef.value) return [];

  return studentListRef.value.filter(studentItem => studentItem.status === StudentStatusEnum.Active);
});

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

const attendanceStatusIconMap: Record<AttendanceStatusEnum, "check" | "clock" | "x"> = {
  Present: "check",
  Tardy: "clock",
  Absent: "x"
};

const studentStatusColorMap: Record<StudentStatusEnum, "success" | "neutral" | "info"> = {
  [StudentStatusEnum.Active]: "success",
  [StudentStatusEnum.Inactive]: "neutral",
  [StudentStatusEnum.Graduated]: "info"
};

function getTotalSessionsForStudent(_studentId: string): number {
  // TODO: replace with real aggregation once session history querying is wired up.
  return 0;
}

const rowSelectionRef = ref<Record<string, boolean>>({});

const isEditModalOpenRef = ref(false);
const editFormStateRef = reactive<Student>({
  id: "",
  firstName: "",
  lastName: "",
  preferredName: "",
  email: "",
  phoneNumber: "",
  status: StudentStatusEnum.Active,
  year: 0
});

function openEditModal(student: Student) {
  Object.assign(editFormStateRef, student);
  isEditModalOpenRef.value = true;
}

function handleCancelEdit() {
  isEditModalOpenRef.value = false;
}

async function handleSaveEdit() {
  await saveStudent({ ...editFormStateRef });
  isEditModalOpenRef.value = false;
}

const isContactModalOpenRef = ref(false);
const contactStudentRef = ref<Student | null>(null);

function openContactModal(student: Student) {
  contactStudentRef.value = student;
  isContactModalOpenRef.value = true;
}

const tableColumnList: TableColumn<Student>[] = [
  {
    accessorKey: "name",
    meta: { class: { th: "w-[20%]", td: "w-[20%]" } },
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
    cell: ({ row }) => {
      const fullName = `${row.original.firstName} ${row.original.lastName}`;
      return row.original.preferredName
        ? h("div", [h("div", fullName), h("div", { class: "text-xs text-muted" }, `"${row.original.preferredName}"`)])
        : fullName;
    }
  },
  {
    id: "attendance",
    enableSorting: true,
    meta: { class: { th: "w-[30%]", td: "w-[30%]" } },
    header: ({ column }) => {
      const isSorted = column.getIsSorted();
      return h(UButton, {
        color: "neutral",
        variant: "ghost",
        label: "Attendance",
        icon: isSorted ? (isSorted === "asc" ? "i-lucide-arrow-up-narrow-wide" : "i-lucide-arrow-down-wide-narrow") : "i-lucide-arrow-up-down",
        class: "-mx-2.5",
        onClick: () => column.toggleSorting(column.getIsSorted() === "asc")
      });
    },
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
            onClick: () => setAttendanceStatus(row.original.id, statusOption)
          }))
      );
    }
  },
  {
    id: "totalSessions",
    header: "# Sessions",
    enableSorting: false,
    cell: ({ row }) => getTotalSessionsForStudent(row.original.id)
  },
  {
    id: "status",
    header: "Status",
    enableSorting: false,
    cell: ({ row }) =>
      h(UBadge, { variant: "subtle", color: studentStatusColorMap[row.original.status] }, () => row.original.status)
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    cell: ({ row }) =>
      h("div", { class: "flex gap-2 justify-end" }, [
        h(UButton, {
          icon: "i-lucide-pencil",
          color: "neutral",
          variant: "ghost",
          size: "sm",
          class: "w-8 justify-center",
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

const items = ref<StudentStatusEnum[]>([StudentStatusEnum.Active, StudentStatusEnum.Inactive, StudentStatusEnum.Graduated]);
const value = ref<StudentStatusEnum>(StudentStatusEnum.Active);
</script>

<template>
  <div class="space-y-3">
    <div class="border border-muted rounded-md overflow-hidden">
      <div class="flex-1 divide-y divide-accented w-full">
        <div class="flex items-center gap-2 px-4 py-3.5 overflow-x-auto">
          <UButton
            color="neutral"
            label="New Student"
            icon="i-lucide-user-round-plus"
          />
          <USelect
            v-model="value"
            :items="items"
          />
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
          class="h-96"
        />
        <div class="px-4 py-3.5 text-sm text-muted">
          row(s) selected.
        </div>
      </div>
    </div>

    <UModal
      v-model:open="isEditModalOpenRef"
      title="Edit Student"
    >
      <template #body>
        <div class="space-y-4">
          <UFormField label="First name">
            <UInput
              v-model="editFormStateRef.firstName"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Last name">
            <UInput
              v-model="editFormStateRef.lastName"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Preferred name">
            <UInput
              v-model="editFormStateRef.preferredName"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Email">
            <UInput
              v-model="editFormStateRef.email"
              type="email"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Phone number">
            <UInput
              v-model="editFormStateRef.phoneNumber"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Status">
            <USelect
              v-model="editFormStateRef.status"
              :items="Object.values(StudentStatusEnum)"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Year">
            <UInputNumber
              v-model="editFormStateRef.year"
              class="w-full"
            />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton
            label="Cancel"
            color="neutral"
            variant="outline"
            @click="handleCancelEdit"
          />
          <UButton
            label="Save"
            @click="handleSaveEdit"
          />
        </div>
      </template>
    </UModal>

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
