<script setup lang="ts">
import type { FormError } from "@nuxt/ui";
import { z } from "zod";

import { type Student, studentSchema, StudentStatusEnum } from "~/schemas/student.schema";
import { nameSchema } from "~/schemas/utils";

type StudentFormState = {
  firstName: string
  lastName: string
  preferredName: string
  email: string
  phoneNumber: string
  status: StudentStatusEnum
  year: number | undefined
};

// Creates a student when `student` is omitted, otherwise edits it.
const props = defineProps<{
  student?: Student
  defaultStatus?: StudentStatusEnum
}>();

const isOpenRef = defineModel<boolean>("open", { default: false });

const toast = useToast();
const { studentListRef, saveStudent } = useStudentRepository();

const formStateRef = reactive<StudentFormState>(createFormState());

function createFormState(): StudentFormState {
  const { student } = props;
  return {
    firstName: student?.firstName ?? "",
    lastName: student?.lastName ?? "",
    preferredName: student?.preferredName ?? "",
    email: student?.email ?? "",
    phoneNumber: formatPhoneNumber(student?.phoneNumber),
    status: student?.status ?? props.defaultStatus ?? StudentStatusEnum.Active,
    year: student?.year ?? 0
  };
}

// Reset on every open so a cancelled edit doesn't leak into the next one.
watch(isOpenRef, (isOpen) => {
  if (isOpen) Object.assign(formStateRef, createFormState());
});

// Email and phone must be unique across students; the student being edited doesn't conflict with itself.
function findOtherStudent(predicate: (student: Student) => boolean) {
  return (studentListRef.value ?? []).find(student => student.id !== props.student?.id && predicate(student));
}

function validateForm(state: Partial<StudentFormState>): FormError[] {
  const errorList: FormError[] = [];

  const firstName = (state.firstName ?? "").trim();
  const lastName = (state.lastName ?? "").trim();
  if (!firstName && !lastName) {
    errorList.push({ name: "firstName", message: "Enter a first or last name." });
  }
  for (const [name, value] of [["firstName", firstName], ["lastName", lastName], ["preferredName", (state.preferredName ?? "").trim()]] as const) {
    const nameResult = value ? nameSchema.safeParse(value) : undefined;
    if (nameResult && !nameResult.success) errorList.push({ name, message: nameResult.error.issues[0]?.message ?? "Invalid name." });
  }

  const email = normalizeEmail(state.email ?? "");
  if (email) {
    const emailOwner = z.email().safeParse(email).success ? findOtherStudent(student => student.email?.toLowerCase() === email) : undefined;
    if (!z.email().safeParse(email).success) errorList.push({ name: "email", message: "Enter a valid email address." });
    else if (emailOwner) errorList.push({ name: "email", message: `Already used by ${getStudentFullName(emailOwner)}.` });
  }

  const phoneText = (state.phoneNumber ?? "").trim();
  if (phoneText) {
    const phoneNumber = normalizePhoneNumber(phoneText);
    const phoneOwner = phoneNumber ? findOtherStudent(student => student.phoneNumber === phoneNumber) : undefined;
    if (!phoneNumber) errorList.push({ name: "phoneNumber", message: "Enter a valid phone number, e.g. (555) 123-4567." });
    else if (phoneOwner) errorList.push({ name: "phoneNumber", message: `Already used by ${getStudentFullName(phoneOwner)}.` });
  }

  if (state.year === undefined || state.year < 0 || state.year > 10) {
    errorList.push({ name: "year", message: "Year must be between 0 and 10." });
  }
  return errorList;
}

function showError(title: string, description?: string) {
  toast.add({ title, description, color: "error", icon: "i-lucide-circle-x" });
}

async function handleSave() {
  const studentResult = studentSchema.safeParse({
    id: props.student?.id ?? crypto.randomUUID(),
    firstName: formStateRef.firstName.trim(),
    lastName: formStateRef.lastName.trim(),
    preferredName: formStateRef.preferredName.trim() || undefined,
    email: normalizeEmail(formStateRef.email) || undefined,
    phoneNumber: normalizePhoneNumber(formStateRef.phoneNumber) || undefined,
    status: formStateRef.status,
    year: formStateRef.year
  });
  if (!studentResult.success) {
    showError("Check student details", studentResult.error.issues[0]?.message);
    return;
  }

  try {
    await saveStudent(studentResult.data);
    isOpenRef.value = false;
    toast.add({ title: "Student saved", color: "success", icon: "i-lucide-circle-check" });
  } catch (saveError) {
    console.error("Student save failed:", saveError);
    showError("Couldn't save student", saveError instanceof Error ? saveError.message : undefined);
  }
}
</script>

<template>
  <UModal
    v-model:open="isOpenRef"
    :title="student ? 'Edit student' : 'New student'"
  >
    <template #body>
      <UForm
        id="student-form"
        :state="formStateRef"
        :validate="validateForm"
        :validate-on="['input', 'change']"
        class="space-y-4"
        @submit="handleSave"
      >
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField
            label="First name"
            name="firstName"
          >
            <UInput
              v-model="formStateRef.firstName"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Last name"
            name="lastName"
          >
            <UInput
              v-model="formStateRef.lastName"
              class="w-full"
            />
          </UFormField>
        </div>
        <UFormField
          label="Preferred name"
          name="preferredName"
        >
          <UInput
            v-model="formStateRef.preferredName"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Email"
          name="email"
        >
          <UInput
            v-model="formStateRef.email"
            type="email"
            inputmode="email"
            autocomplete="off"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Phone"
          name="phoneNumber"
          hint="Any format; saved as an international number"
        >
          <UInput
            v-model="formStateRef.phoneNumber"
            type="tel"
            inputmode="tel"
            autocomplete="off"
            class="w-full"
          />
        </UFormField>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField
            label="Status"
            name="status"
          >
            <USelect
              v-model="formStateRef.status"
              :items="Object.values(StudentStatusEnum)"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Year"
            name="year"
          >
            <UInputNumber
              v-model="formStateRef.year"
              :min="0"
              :max="10"
              class="w-full"
            />
          </UFormField>
        </div>
      </UForm>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          type="button"
          label="Cancel"
          color="neutral"
          variant="outline"
          @click="isOpenRef = false"
        />
        <UButton
          type="submit"
          form="student-form"
          label="Save"
          loading-auto
        />
      </div>
    </template>
  </UModal>
</template>
