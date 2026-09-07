<script setup lang="ts">
import { CalendarDate, getLocalTimeZone } from "@internationalized/date";
import type { FormSubmitEvent } from "@nuxt/ui";

const isModalOpen = defineModel<boolean>("open", { required: true });

// #region Form State
const { minCalendarDate, maxCalendarDate } = getSessionDateBounds();

const sessionFormRef = useTemplateRef("sessionFormRef");
const sessionFormState = reactive<SessionCreateModal>({
  name: "",
  date: new Date(Date.now())
});

const sessionFormInputDateRef = useTemplateRef("sessionFormInputDateRef");
const sessionFormCalendarDate = computed({
  get: () => {
    const jsDate = sessionFormState.date;
    return new CalendarDate(jsDate.getFullYear(), jsDate.getMonth() + 1, jsDate.getDate());
  },
  set: (newCalendarDate) => {
    const resetNameToDefault = isSessionFormNameDefault.value;
    sessionFormState.date = newCalendarDate.toDate(getLocalTimeZone());

    if (resetNameToDefault) resetSessionFormName();
  }
});

const isSessionFormNameDefault = computed(() => {
  return getFormattedSessionName(sessionFormState.date) === sessionFormState.name;
});

function getFormattedSessionName(date: Date): string {
  if (!sessionFormState.date) return "Session";
  return `Session (${sessionFormState.date.getFullYear()}-${String(sessionFormState.date.getMonth() + 1).padStart(2, "0")}-${String(sessionFormState.date.getDate()).padStart(2, "0")})`;
}

function resetSessionFormName() {
  sessionFormState.name = getFormattedSessionName(sessionFormState.date);
}

function reset() {
  sessionFormState.date = new Date(Date.now());
  resetSessionFormName();
}

reset();

watch(isModalOpen, (isNowOpen) => {
  if (!isNowOpen) return;
  reset();
});
watch(sessionFormCalendarDate, (newDate, oldDate) => {
  if (getFormattedSessionName(oldDate.toDate(getLocalTimeZone())) === sessionFormState.name) {
    sessionFormState.name = getFormattedSessionName(newDate.toDate(getLocalTimeZone()));
  }
});
// #endregion

const emit = defineEmits<{
  submit: [data: Session]
}>();

async function onSubmit(event: FormSubmitEvent<SessionCreateModal>) {
  await new Promise(res => setTimeout(res, 1000));

  const newSession: Session = {
    ...event.data,
    id: crypto.randomUUID(),
    status: SessionStatusEnum.Drafting,
    overview: "Placas 2",
    createdAt: new Date(Date.now()),
    studentRoster: [],
    studentAttendance: new Map()
  };
  emit("submit", newSession);
  onClose();
}

function onClose() {
  isModalOpen.value = false;
}
</script>

<template>
  <UModal
    v-model:open="isModalOpen"
    title="New Session"
    description="Enter the new session's details."
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
            <template
              v-if="!isSessionFormNameDefault"
              #trailing
            >
              <UButton
                color="neutral"
                variant="link"
                size="sm"
                icon="i-lucide-undo-2"
                aria-label="Revert session name to default"
                @click="resetSessionFormName"
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
            class="w-full"
          >
            <template #trailing>
              <UPopover
                :content="{
                  align: 'center',
                  side: 'left',
                  sideOffset: 108
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
                    :min-value="minCalendarDate"
                    :max-value="maxCalendarDate"
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
        label="Cancel"
        type="button"
        color="neutral"
        variant="ghost"
        @click="close"
      />
      <UButton
        label="Create"
        loading-auto
        @click="sessionFormRef?.submit()"
      />
    </template>
  </UModal>
</template>
