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
const { importOnboardingDataFromJson } = useOnboardingImport();

const classEndDate = new Date();
classEndDate.setMonth(classEndDate.getMonth() + 6);
const formStateRef = reactive<OnboardingFormState>({
  user: { id: crypto.randomUUID(), firstName: "", lastName: "" },
  classInfo: { id: crypto.randomUUID(), name: "", startDate: new Date(), endDate: classEndDate }
});

const hasAttemptedSubmitRef = ref(false);
const importErrorListRef = ref<string[]>([]);
const isImportingRef = ref(false);
const importFileInputRef = ref<HTMLInputElement>();

async function handleOnboardingSubmit() {
  await saveUser(formStateRef.user);
  await saveClass(formStateRef.classInfo);
  return new Promise<void>(res => setTimeout(res, 3000));
}

function handleOnboardingError(_formErrorEvent: FormErrorEvent) {
  hasAttemptedSubmitRef.value = true;
}

function triggerImportFilePicker() {
  importFileInputRef.value?.click();
}

async function handleImportFileSelected(fileInputEvent: Event) {
  const selectedFile = (fileInputEvent.target as HTMLInputElement).files?.[0];
  if (!selectedFile) return;

  isImportingRef.value = true;
  importErrorListRef.value = [];

  const { issueList } = await importOnboardingDataFromJson(selectedFile);
  importErrorListRef.value = issueList;

  isImportingRef.value = false
  ;(fileInputEvent.target as HTMLInputElement).value = "";
}
</script>

<template>
  <div class="flex flex-col items-center gap-6">
    <AppLogo class="h-5 w-auto" />
    <UCard class="w-full max-w-md">
      <template #header>
        <h1 class="text-lg font-semibold">
          Welcome — let's get set up
        </h1>
        <p class="text-sm text-muted">
          Enter your info and your first class to continue.
        </p>
      </template>

      <UForm
        :schema="onboardingSchema"
        :state="formStateRef"
        :validate-on="hasAttemptedSubmitRef ? ['input', 'blur', 'submit'] : ['submit']"
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
          <InputDate
            v-model="formStateRef.classInfo.startDate"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="End date"
          name="classInfo.endDate"
        >
          <InputDate
            v-model="formStateRef.classInfo.endDate"
            class="w-full"
          />
        </UFormField>
        <UButton
          loading-auto
          type="submit"
          block
        >
          Continue
        </UButton>
      </UForm>

      <USeparator
        label="OR"
        class="my-4"
      />

      <div class="space-y-2 text-center">
        <UButton
          icon="i-lucide-upload"
          color="neutral"
          variant="outline"
          block
          :loading="isImportingRef"
          @click="triggerImportFilePicker"
        >
          Import profile
        </UButton>
        <input
          ref="importFileInputRef"
          type="file"
          accept="application/json"
          class="hidden"
          @change="handleImportFileSelected"
        >
      </div>

      <UAlert
        v-if="importErrorListRef.length"
        color="error"
        title="Import failed"
        :description="importErrorListRef.join(' | ')"
        class="mt-4"
      />
    </UCard>
  </div>
</template>
