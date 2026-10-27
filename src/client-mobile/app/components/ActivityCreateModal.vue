<script setup lang="ts">
import type { FormError } from "@nuxt/ui";

import { activityNameSchema } from "~/schemas/activity-type.schema";

const isOpenRef = defineModel<boolean>("open", { default: false });

// Emits the saved activity's name so the caller can assign it.
const emit = defineEmits<{ created: [name: string] }>();

const toast = useToast();
const { isActivityNameTaken, saveActivityType } = useActivityTypeRepository();

const formStateRef = reactive({ name: "" });

// Reset on every open so a cancelled entry doesn't leak into the next one.
watch(isOpenRef, (isOpen) => {
  if (isOpen) formStateRef.name = "";
});

function validateForm(state: Partial<typeof formStateRef>): FormError[] {
  const nameResult = activityNameSchema.safeParse(state.name ?? "");
  if (!nameResult.success) return [{ name: "name", message: nameResult.error.issues[0]?.message ?? "Invalid activity name." }];
  if (isActivityNameTaken(nameResult.data)) return [{ name: "name", message: "This activity already exists." }];
  return [];
}

async function handleSave() {
  try {
    const activityType = await saveActivityType(formStateRef.name);
    isOpenRef.value = false;
    emit("created", activityType.name);
  } catch (saveError) {
    console.error("Activity save failed:", saveError);
    toast.add({
      title: "Couldn't add activity",
      description: saveError instanceof Error ? saveError.message : undefined,
      color: "error",
      icon: "i-lucide-circle-x"
    });
  }
}
</script>

<template>
  <UModal
    v-model:open="isOpenRef"
    title="Add activity"
  >
    <template #body>
      <UForm
        id="activity-form"
        :state="formStateRef"
        :validate="validateForm"
        :validate-on="['input', 'change']"
        @submit="handleSave"
      >
        <UFormField
          label="Activity"
          name="name"
        >
          <UInput
            v-model="formStateRef.name"
            autofocus
            autocomplete="off"
            class="w-full"
          />
        </UFormField>
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
          form="activity-form"
          label="Add"
          loading-auto
        />
      </div>
    </template>
  </UModal>
</template>
