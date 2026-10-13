<script setup lang="ts">
import { AutoArchiveUnitEnum, type UserSettings, userSettingsSchema } from "~/schemas/user.schema";

const toast = useToast();
const { currentUserSettingsRef, saveUserSettings } = useUserRepository();
const { sessionListRef } = useSessionRepository();

// #region Auto-archive
const settingsFormStateRef = reactive<UserSettings>(structuredClone(toRaw(currentUserSettingsRef.value)));

watch(currentUserSettingsRef, (savedSettings) => {
  Object.assign(settingsFormStateRef, structuredClone(toRaw(savedSettings)));
});

const autoArchiveUnitOptionList = Object.values(AutoArchiveUnitEnum).map(unit => ({ label: unit.toLowerCase(), value: unit }));

const hasUnsavedChangesRef = computed(() =>
  JSON.stringify(settingsFormStateRef) !== JSON.stringify(currentUserSettingsRef.value));

// Preview so shortening the threshold doesn't archive a batch of sessions by surprise.
const dueSessionCountRef = computed(() => {
  const settingsResult = userSettingsSchema.safeParse(settingsFormStateRef);
  if (!settingsResult.success) return 0;
  return (sessionListRef.value ?? []).filter(sessionItem => isSessionDueForAutoArchive(sessionItem, settingsResult.data)).length;
});

async function handleSaveSettings() {
  try {
    await saveUserSettings(settingsFormStateRef);
    toast.add({ title: "Settings saved", color: "success", icon: "i-lucide-circle-check" });
  } catch (saveError) {
    console.error("Settings save failed:", saveError);
    toast.add({ title: "Couldn't save settings", color: "error", icon: "i-lucide-circle-x" });
  }
}

function handleResetSettings() {
  Object.assign(settingsFormStateRef, structuredClone(toRaw(currentUserSettingsRef.value)));
}
// #endregion

// #region Feedback
// Awaiting the warm-up lets the very first preview play instead of only loading the sound.
async function previewHaptic() {
  await primeFeedback();
  triggerHaptic();
}

async function previewSound() {
  await primeFeedback();
  triggerSound();
}
// #endregion
</script>

<template>
  <div class="flex flex-col w-full max-w-2xl mx-auto px-4 py-8 sm:px-6 sm:py-10 gap-6">
    <h2>Settings</h2>

    <UForm
      :schema="userSettingsSchema"
      :state="settingsFormStateRef"
      class="border border-muted rounded-md divide-y divide-muted"
      @submit="handleSaveSettings"
    >
      <div class="px-4 py-3.5">
        <h3 class="font-medium">
          Sessions
        </h3>
      </div>

      <div class="space-y-4 px-4 py-4">
        <UFormField
          name="autoArchive.enabled"
          label="Auto-archive completed sessions"
          description="Archived sessions are hidden from the main list. You can still view and unarchive them."
          :ui="{ root: 'flex items-start justify-between gap-4', container: 'mt-0' }"
        >
          <USwitch v-model="settingsFormStateRef.autoArchive.enabled" />
        </UFormField>

        <UFormField
          name="autoArchive.amount"
          label="Archive after"
          description="Measured from when the session was marked completed (or last unarchived)."
        >
          <div class="flex gap-2">
            <UInputNumber
              v-model="settingsFormStateRef.autoArchive.amount"
              :min="1"
              :max="999"
              :disabled="!settingsFormStateRef.autoArchive.enabled"
              class="w-32"
            />
            <USelect
              v-model="settingsFormStateRef.autoArchive.unit"
              :items="autoArchiveUnitOptionList"
              :disabled="!settingsFormStateRef.autoArchive.enabled"
              class="w-32"
            />
          </div>
        </UFormField>

        <UAlert
          v-if="hasUnsavedChangesRef && dueSessionCountRef > 0"
          color="warning"
          variant="subtle"
          icon="i-lucide-archive"
          :title="`${dueSessionCountRef} completed ${dueSessionCountRef === 1 ? 'session' : 'sessions'} will be archived when you save.`"
        />
      </div>

      <div class="px-4 py-3.5">
        <h3 class="font-medium">
          Sliders
        </h3>
      </div>

      <div class="space-y-4 px-4 py-4">
        <UFormField
          name="feedback.haptics"
          label="Vibration"
          description="A small tap each time a score changes while sliding. Not available on every device."
          :ui="{ root: 'flex items-start justify-between gap-4', container: 'mt-0 flex items-center gap-3' }"
        >
          <UButton
            type="button"
            label="Try"
            color="neutral"
            variant="ghost"
            size="xs"
            @click="previewHaptic"
          />
          <USwitch v-model="settingsFormStateRef.feedback.haptics" />
        </UFormField>

        <UFormField
          name="feedback.sound"
          label="Sound"
          description="A soft tick each time a score changes while sliding. Silent if the device is muted."
          :ui="{ root: 'flex items-start justify-between gap-4', container: 'mt-0 flex items-center gap-3' }"
        >
          <UButton
            type="button"
            label="Try"
            color="neutral"
            variant="ghost"
            size="xs"
            @click="previewSound"
          />
          <USwitch v-model="settingsFormStateRef.feedback.sound" />
        </UFormField>
      </div>

      <div class="flex justify-end gap-2 px-4 py-3">
        <UButton
          label="Reset"
          color="neutral"
          variant="ghost"
          :disabled="!hasUnsavedChangesRef"
          @click="handleResetSettings"
        />
        <UButton
          type="submit"
          label="Save"
          loading-auto
          :disabled="!hasUnsavedChangesRef"
        />
      </div>
    </UForm>
  </div>
</template>
