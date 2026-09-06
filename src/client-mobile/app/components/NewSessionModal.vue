<script setup lang="ts">
import { CalendarDate, getLocalTimeZone, today } from "@internationalized/date";
import type { FormSubmitEvent } from "@nuxt/ui";

import { sessionCreateModalSchema } from "~/schemas/session.schema.ts";

const isModalOpen = ref(true);

// #region Form State
const sessionFormRef = useTemplateRef("sessionFormRef");
const sessionFormState = reactive<SessionCreateModal>({
  name: "",
  date: new Date(Date.now())
});

const dateToday = today(getLocalTimeZone());
const sessionFormInputDateRef = useTemplateRef("sessionFormInputDateRef");
const sessionFormCalendarDate = computed({
  get: () => {
    const jsDate = sessionFormState.date;
    return new CalendarDate(jsDate.getFullYear(), jsDate.getMonth() + 1, jsDate.getDate());
  },
  set: (newCalendarDate) => {
    sessionFormState.date = newCalendarDate.toDate(getLocalTimeZone());
  }
});

const isSessionFormNameDefault = ref(true);
const sessionFormDefaultName = computed(() => {
  if (!sessionFormState.date) return "Session";
  return `Session (${sessionFormState.date.getFullYear()}-${String(sessionFormState.date.getMonth() + 1).padStart(2, "0")}-${String(sessionFormState.date.getDate()).padStart(2, "0")})`;
});
sessionFormState.name = sessionFormDefaultName.value;

watch(sessionFormDefaultName, () => {
  if (!isSessionFormNameDefault.value) return;

  sessionFormState.name = sessionFormDefaultName.value;
});
watch(() => sessionFormState.name, (newName, oldName) => {
  if (oldName === sessionFormDefaultName.value) {
    isSessionFormNameDefault.value = false;
  }
  if (newName === sessionFormDefaultName.value) {
    isSessionFormNameDefault.value = true;
  }
});
// #endregion

const emit = defineEmits<{
  submit: [data: SessionCreateModal]
}>();

function onSubmit(event: FormSubmitEvent<SessionCreateModal>) {
  emit("submit", event.data);
  isModalOpen.value = false;
  console.log("submit", event);
}
</script>

<template>
  <UModal
    v-model:open="isModalOpen"
    title="New Session"
    description="Enter the new session's details."
    :close="{
      color: 'neutral',
      variant: 'soft',
      class: 'rounded-full',
      onClick: () => isModalOpen = false
    }"
  >
    <template #body>
      <UForm
        ref="sessionFormRef"
        :schema="sessionCreateModalSchema"
        :state="sessionFormState"
        :validate-on="[]"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField
          label="Name"
          name="name"
        >
          <UInput
            v-model="sessionFormState.name"
            class="w-full"
            :ui="{ trailing: 'pe-1' }"
          >
            <template v-if="!isSessionFormNameDefault" #trailing>
              <UButton
                color="neutral"
                variant="link"
                size="sm"
                icon="i-lucide-undo-2"
                aria-label="Revert session name to default"
                @click="sessionFormState.name = sessionFormDefaultName"
              />
            </template>
          </UInput>
        </UFormField>

        <UFormField
          label="Date"
          name="date"
        >
          <UInputDate
            ref="sessionFormInputDateRef"
            v-model="sessionFormCalendarDate"
            :min-value="dateToday.subtract({ years: 1 })"
            :max-value="dateToday.add({ years: 1 })"
            class="w-full"
          >
            <template #trailing>
              <UPopover
                :content="{
                  align: 'center',
                  side: 'bottom',
                  sideOffset: 8
                }"
                :reference="sessionFormInputDateRef?.inputsRef[3]?.$el"
              >
                <UButton
                  color="neutral"
                  variant="link"
                  size="sm"
                  icon="i-lucide-calendar"
                  aria-label="Select a date"
                  class="px-0"
                />

                <template #content>
                  <UCalendar
                    v-model="sessionFormCalendarDate"
                    class="p-2"
                  />
                </template>
              </UPopover>
            </template>
          </UInputDate>
        </UFormField>
      </UForm>
    </template>

    <template #footer="{ close }">
      <UButton
        type="button"
        color="neutral"
        variant="ghost"
        @click="close"
      >
        Cancel
      </UButton>
      <UButton @click="sessionFormRef?.submit()">
        Create
      </UButton>
    </template>
  </UModal>
</template>
