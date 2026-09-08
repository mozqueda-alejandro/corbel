<script setup lang="ts">
import { CalendarDate, type DateValue } from "@internationalized/date";

defineOptions({ inheritAttrs: false });

const modelValueRef = defineModel<Date>();

withDefaults(defineProps<{
  minValue?: CalendarDate
  maxValue?: CalendarDate
  popoverAlign?: "start" | "center" | "end"
  popoverSide?: "top" | "right" | "bottom" | "left"
  popoverSideOffset?: number
}>(), {
  popoverAlign: "center",
  popoverSide: "left",
  popoverSideOffset: 108
});

function toCalendarDate(dateValue: Date): CalendarDate {
  return new CalendarDate(dateValue.getFullYear(), dateValue.getMonth() + 1, dateValue.getDate());
}

function toNativeDate(calendarDateValue: DateValue): Date {
  return new Date(calendarDateValue.year, calendarDateValue.month - 1, calendarDateValue.day);
}

const calendarValueRef = computed<CalendarDate | undefined>({
  get: () => (modelValueRef.value ? toCalendarDate(modelValueRef.value) : undefined),
  set: (newCalendarDate) => {
    modelValueRef.value = newCalendarDate ? toNativeDate(newCalendarDate) : undefined;
  }
});

const inputDateRef = ref();

defineExpose({
  inputsRef: computed(() => inputDateRef.value?.inputsRef)
});
</script>

<template>
  <UInputDate
    ref="inputDateRef"
    v-model="calendarValueRef"
    v-bind="$attrs"
  >
    <template
      v-for="(_, slotName) in $slots"
      #[slotName]="slotProps"
      :key="slotName"
    >
      <slot
        :name="slotName"
        v-bind="slotProps"
      />
    </template>

    <template #trailing>
      <UPopover
        :content="{
          align: popoverAlign,
          side: popoverSide,
          sideOffset: popoverSideOffset
        }"
        :reference="inputDateRef?.inputsRef?.[3]?.$el"
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
            v-model="calendarValueRef"
            :min-value="minValue"
            :max-value="maxValue"
            class="p-2"
          />
        </template>
      </UPopover>
    </template>
  </UInputDate>
</template>
