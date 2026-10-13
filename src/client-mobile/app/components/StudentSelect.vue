<script setup lang="ts">
import type { SelectMenuItem } from "@nuxt/ui";

import type { Student } from "~/schemas/student.schema";

type ProgressGroup = { progress: string | undefined, label: string };

// Students missing from progressByStudentId have no progress value, which matches the group whose
// progress is undefined. Students whose progress matches no group are not listed.
const props = withDefaults(defineProps<{
  studentList: Student[]
  progressByStudentId: Record<string, string>
  groupList?: ProgressGroup[]
  disabled?: boolean
}>(), {
  groupList: () => [
    { progress: undefined, label: "Not started" },
    { progress: "saved", label: "Saved" },
    { progress: "submitted", label: "Submitted" }
  ]
});

const studentIdRef = defineModel<string | undefined>();

const itemListRef = computed(() => {
  const itemList: SelectMenuItem[] = [];

  for (const group of props.groupList) {
    const groupItemList = props.studentList
      .filter(studentItem => props.progressByStudentId[studentItem.id] === group.progress)
      .map(studentItem => ({ id: studentItem.id, label: `${studentItem.firstName} ${studentItem.lastName}`.trim() }))
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
    class="w-full"
  />
</template>
