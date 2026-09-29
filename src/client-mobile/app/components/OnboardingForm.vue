<script setup lang="ts">
const { importOnboardingDataFromJson } = useOnboardingImport();
const toast = useToast();

const isImportingRef = ref(false);
const importFileInputRef = ref<HTMLInputElement>();

function triggerImportFilePicker() {
  importFileInputRef.value?.click();
}

async function handleImportFileSelected(fileInputEvent: Event) {
  const selectedFile = (fileInputEvent.target as HTMLInputElement).files?.[0];
  if (!selectedFile) return;

  isImportingRef.value = true;

  const { issueList } = await importOnboardingDataFromJson(selectedFile);

  isImportingRef.value = false;
  (fileInputEvent.target as HTMLInputElement).value = "";

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
    </UCard>
  </div>
</template>
