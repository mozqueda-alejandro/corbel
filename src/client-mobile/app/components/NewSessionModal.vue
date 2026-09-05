<script setup lang="ts">
import type { FormSubmitEvent } from "@nuxt/ui";
import { z } from "zod";

const studentFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.email("Invalid email address"),
  isEnrolled: z.boolean(),
  receivesNotifications: z.boolean()
});

type StudentFormData = z.infer<typeof studentFormSchema>;

const isModalOpen = ref(false);

const formState = reactive<StudentFormData>({
  firstName: "",
  lastName: "",
  email: "",
  isEnrolled: false,
  receivesNotifications: false
});

const emit = defineEmits<{
  submit: [data: StudentFormData]
}>();

function handleSubmit(event: FormSubmitEvent<StudentFormData>) {
  emit("submit", event.data);
  isModalOpen.value = false;
}
</script>

<template>
  <UModal
    v-model:open="isModalOpen"
    title="New Session"
    description="Enter the student's details below."
    :close="{
      color: 'primary',
      variant: 'outline',
      class: 'rounded-full',
      onClick: () => isModalOpen = false
    }"
  >
    <template #body>
      <UForm
        :schema="studentFormSchema"
        :state="formState"
        class="space-y-4"
        @submit="handleSubmit"
      >
        <UFormField
          label="First Name"
          name="firstName"
        >
          <UInput v-model="formState.firstName" />
        </UFormField>

        <UFormField
          label="Last Name"
          name="lastName"
        >
          <UInput v-model="formState.lastName" />
        </UFormField>

        <UFormField
          label="Email"
          name="email"
        >
          <UInput
            v-model="formState.email"
            type="email"
          />
        </UFormField>

        <UFormField name="isEnrolled">
          <UCheckbox
            v-model="formState.isEnrolled"
            label="Currently enrolled"
          />
        </UFormField>

        <UFormField name="receivesNotifications">
          <UCheckbox
            v-model="formState.receivesNotifications"
            label="Receives notifications"
          />
        </UFormField>
      </UForm>
    </template>

    <template #footer="{ close }">
      <div class="flex justify-end gap-2">
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          @click="close"
        >
          Cancel
        </UButton>
        <UButton @click="() => $refs.form?.submit?.()">
          Submit
        </UButton>
      </div>
    </template>
  </UModal>
</template>
