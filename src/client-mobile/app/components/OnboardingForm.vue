<script setup lang="ts">
const { importOnboardingDataFromJson } = useOnboardingImport();
const toast = useToast();
const { isOnboardingImportActiveRef } = useAppReadiness();

const isImportingRef = ref(false);
const isDemoImportingRef = ref(false);
const importFileInputRef = ref<HTMLInputElement>();

const isBusyRef = computed(() => isImportingRef.value || isDemoImportingRef.value);

function triggerImportFilePicker() {
  importFileInputRef.value?.click();
}

async function importProfileFile(profileFile: File) {
  isOnboardingImportActiveRef.value = true;
  try {
    const { issueList } = await importOnboardingDataFromJson(profileFile);

    if (issueList.length > 0) {
      console.error("Onboarding import failed:", issueList);
      toast.add({
        title: "Import failed",
        description: "Something went wrong importing your onboarding data.",
        color: "error",
        icon: "i-lucide-circle-x"
      });
      return;
    }

    // Navigate while the form is still showing; the app only appears once it is already at the index page.
    await navigateTo("/");
  } finally {
    isOnboardingImportActiveRef.value = false;
  }
}

async function handleImportFileSelected(fileInputEvent: Event) {
  const fileInput = fileInputEvent.target as HTMLInputElement;
  const selectedFile = fileInput.files?.[0];
  if (!selectedFile) return;

  isImportingRef.value = true;
  try {
    await importProfileFile(selectedFile);
  } finally {
    isImportingRef.value = false;
    fileInput.value = "";
  }
}

// Goes through the same import as a picked file, so the demo exercises the real path.
async function handleDemoImport() {
  isDemoImportingRef.value = true;
  try {
    // Loaded on demand so the sample data isn't part of the initial bundle.
    const { default: demoData } = await import("~/data/onboarding-import-01.json");
    await importProfileFile(new File([JSON.stringify(demoData)], "demo.json", { type: "application/json" }));
  } finally {
    isDemoImportingRef.value = false;
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
          Import your onboarding data to continue.
        </p>
      </template>

      <div class="space-y-2 text-center">
        <UButton
          icon="i-lucide-upload"
          block
          :loading="isImportingRef"
          :disabled="isBusyRef"
          @click="triggerImportFilePicker"
        >
          Import profile
        </UButton>
        <UButton
          icon="i-lucide-flask-conical"
          color="neutral"
          variant="ghost"
          block
          :loading="isDemoImportingRef"
          :disabled="isBusyRef"
          @click="handleDemoImport"
        >
          Try demo data
        </UButton>
        <input
          ref="importFileInputRef"
          type="file"
          accept="application/json"
          class="hidden"
          @change="handleImportFileSelected"
        >
      </div>
    </UCard>
  </div>
</template>
