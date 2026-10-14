<script setup lang="ts">
import type { SelectMenuItem } from "@nuxt/ui";

import type { SessionStudent } from "~/schemas/student.schema";

type Progress = { done: number, total: number };

// Students missing from progressByStudentId haven't started; the rest are in progress or, once every
// part is done, completed.
const props = defineProps<{
  studentList: SessionStudent[]
  progressByStudentId: Record<string, Progress>
  disabled?: boolean
}>();

function getProgress(item: unknown) {
  return (item as { progress?: Progress }).progress;
}

function isComplete(progress: Progress) {
  return progress.done >= progress.total;
}

// The check (or the ratio, on unselected rows) is taken out of the row's flow and the bar keeps room for
// it, so the bars line up whether or not a row is selected.
const menuUi = {
  itemTrailing: "self-center pe-11",
  itemTrailingIcon: "absolute end-2.5 top-1/2 -translate-y-1/2"
};

const studentIdRef = defineModel<string | undefined>();

const groupList = [
  { label: "Not started", isMatch: (progress?: Progress) => !progress },
  { label: "In progress", isMatch: (progress?: Progress) => !!progress && progress.done < progress.total },
  { label: "Completed", isMatch: (progress?: Progress) => !!progress && isComplete(progress) }
];

const itemListRef = computed(() => {
  const itemList: SelectMenuItem[] = [];

  for (const group of groupList) {
    const groupItemList = props.studentList
      .filter(studentItem => group.isMatch(props.progressByStudentId[studentItem.id]))
      .map(studentItem => ({
        id: studentItem.id,
        label: getStudentFullName(studentItem),
        progress: props.progressByStudentId[studentItem.id]
      }))
      .sort((itemA, itemB) => itemA.label.localeCompare(itemB.label));
    if (groupItemList.length === 0) continue;

    if (itemList.length > 0) itemList.push({ type: "separator" });
    itemList.push({ type: "label", label: group.label }, ...groupItemList);
  }

  return itemList;
});
</script>

<template>
  <USelectMenu
    v-model="studentIdRef"
    :items="itemListRef"
    value-key="id"
    icon="i-lucide-user-round"
    placeholder="Select student"
    :search-input="false"
    :disabled="disabled"
    :ui="menuUi"
    class="w-full"
  >
    <template #item-trailing="{ item }">
      <template v-if="getProgress(item)">
        <UProgress
          :model-value="getProgress(item)!.done"
          :max="getProgress(item)!.total"
          :ui="{ indicator: isComplete(getProgress(item)!) ? 'bg-success/70' : 'bg-inverted/45' }"
          size="sm"
          class="w-16"
        />
        <!-- Takes the checkmark's place on rows that aren't selected. -->
        <span class="absolute end-2.5 top-1/2 -translate-y-1/2 text-xs tabular-nums text-dimmed group-data-[state=checked]:hidden">
          {{ getProgress(item)!.done }}/{{ getProgress(item)!.total }}
        </span>
      </template>
    </template>
  </USelectMenu>
</template>
