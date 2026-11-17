<script setup lang="ts">
import { getSessionDateBounds } from "~/schemas/utils";

const { completeOnboarding } = useOnboarding();
const { importProfileFromJson } = useProfile();
const toast = useToast();
const { isOnboardingImportActiveRef } = useAppReadiness();

const today = new Date();
const formStateRef = reactive({
  firstName: "",
  lastName: "",
  className: "",
  startDate: today,
  endDate: new Date(today.getFullYear() + 1, today.getMonth(), today.getDate())
});
const isSubmittingRef = ref(false);
const isImportingRef = ref(false);
const importFileInputRef = useTemplateRef("importFileInputRef");
const isBusyRef = computed(() => isSubmittingRef.value || isImportingRef.value);
const { minCalendarDate } = getSessionDateBounds();

// Both ways of finishing setup make the data "ready" the moment they commit, which would swap the app in
// before the form has navigated, so the app stays hidden until then.
async function finishSetup(runSetup: () => Promise<{ issueList: string[] }>, failureTitle: string) {
  isOnboardingImportActiveRef.value = true;
  try {
    const { issueList } = await runSetup();

    if (issueList.length > 0) {
      console.error(`${failureTitle}:`, issueList);
      toast.add({ title: failureTitle, description: issueList[0], color: "error", icon: "i-lucide-circle-x" });
      return;
    }

    // Navigate while the form is still showing; the app only appears once it is already at the index page.
    await navigateTo("/");
  } finally {
    isOnboardingImportActiveRef.value = false;
  }
}

async function handleSubmit() {
  isSubmittingRef.value = true;
  try {
    await finishSetup(() => completeOnboarding({
      firstName: formStateRef.firstName,
      lastName: formStateRef.lastName,
      className: formStateRef.className,
      startDate: formStateRef.startDate,
      endDate: formStateRef.endDate
    }), "Couldn't finish setup");
  } finally {
    isSubmittingRef.value = false;
  }
}

// A profile file brings its own user, classes, tests and daily skills, so the form is skipped.
async function handleImportFileSelected(fileInputEvent: Event) {
  const fileInput = fileInputEvent.target as HTMLInputElement;
  const selectedFile = fileInput.files?.[0];
  if (!selectedFile) return;

  isImportingRef.value = true;
  try {
    await finishSetup(() => importProfileFromJson(selectedFile), "Import failed");
  } finally {
    isImportingRef.value = false;
    fileInput.value = "";
  }
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
          Tell us about you and your class to continue.
        </p>
      </template>

      <form
        class="space-y-4"
        @submit.prevent="handleSubmit"
      >
        <div class="grid grid-cols-2 gap-3">
          <UFormField
            label="First name"
            required
          >
            <UInput
              v-model="formStateRef.firstName"
              autocomplete="given-name"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Last name"
            required
          >
            <UInput
              v-model="formStateRef.lastName"
              autocomplete="family-name"
              class="w-full"
            />
          </UFormField>
        </div>
        <UFormField
          label="Class name"
          required
        >
          <UInput
            v-model="formStateRef.className"
            :maxlength="30"
            class="w-full"
          />
        </UFormField>
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Class starts">
            <InputDate
              v-model="formStateRef.startDate"
              popover-side="bottom"
              :popover-side-offset="8"
            />
          </UFormField>
          <UFormField label="Class ends">
            <InputDate
              v-model="formStateRef.endDate"
              :min-value="minCalendarDate"
              popover-side="bottom"
              popover-align="end"
              :popover-side-offset="8"
            />
          </UFormField>
        </div>
        <UButton
          type="submit"
          block
          :loading="isSubmittingRef"
          :disabled="isBusyRef"
        >
          Get started
        </UButton>
      </form>

      <USeparator
        label="or"
        class="my-4"
      />
      <UButton
        icon="i-lucide-upload"
        color="neutral"
        variant="outline"
        block
        :loading="isImportingRef"
        :disabled="isBusyRef"
        @click="importFileInputRef?.click()"
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
    </UCard>
  </div>
</template>
