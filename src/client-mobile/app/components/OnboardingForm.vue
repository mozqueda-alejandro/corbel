<script setup lang="ts">
import type { FormErrorEvent } from "@nuxt/ui";
import { z } from "zod";

import { classSchema } from "~/schemas/class.schema";
import { userSchema } from "~/schemas/user.schema";

const onboardingSchema = z.object({
  user: userSchema,
  classInfo: classSchema
});
type OnboardingFormState = z.infer<typeof onboardingSchema>;

const { saveUser } = useUserRepository();
const { saveClass } = useClassRepository();

const formStateRef = reactive<OnboardingFormState>({
  user: { id: crypto.randomUUID(), firstName: "", lastName: "" },
  classInfo: { id: crypto.randomUUID(), name: "", startDate: new Date(), endDate: new Date() }
});

const submissionErrorListRef = ref<string[]>([]);

async function handleOnboardingSubmit() {
  submissionErrorListRef.value = [];
  await saveUser(formStateRef.user);
  await saveClass(formStateRef.classInfo);
}

function handleOnboardingError(formErrorEvent: FormErrorEvent) {
  submissionErrorListRef.value = formErrorEvent.errors.map(formError => `${formError.name ?? "form"}: ${formError.message}`);
}
</script>

<template>
  <UCard class="w-full max-w-md">
    <template #header>
      <h1 class="text-lg font-semibold">
        Welcome — let's get set up
      </h1>
      <p class="text-sm text-muted">
        Enter your info and your first class to continue.
      </p>
    </template>

    <UAlert
      v-if="submissionErrorListRef.length"
      color="error"
      title="Please fix the following before continuing"
      :description="submissionErrorListRef.join(' | ')"
      class="mb-4"
    />

    <UForm
      :schema="onboardingSchema"
      :state="formStateRef"
      class="space-y-4"
      @submit="handleOnboardingSubmit"
      @error="handleOnboardingError"
    >
      <UFormField
        label="First name"
        name="user.firstName"
      >
        <UInput
          v-model="formStateRef.user.firstName"
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="Last name"
        name="user.lastName"
      >
        <UInput
          v-model="formStateRef.user.lastName"
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="Class name"
        name="classInfo.name"
      >
        <UInput
          v-model="formStateRef.classInfo.name"
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="Start date"
        name="classInfo.startDate"
      >
        <UInput
          v-model="formStateRef.classInfo.startDate"
          type="date"
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="End date"
        name="classInfo.endDate"
      >
        <UInput
          v-model="formStateRef.classInfo.endDate"
          type="date"
          class="w-full"
        />
      </UFormField>
      <UButton
        type="submit"
        block
      >
        Continue
      </UButton>
    </UForm>
  </UCard>
</template>
