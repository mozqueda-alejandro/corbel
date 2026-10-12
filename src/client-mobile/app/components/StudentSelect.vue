<script setup lang="ts">
import type { SelectMenuItem } from "@nuxt/ui";

import type { Student } from "~/schemas/student.schema";

// Students missing from progressByStudentId have no information yet and are listed first.
const props = defineProps<{
  studentList: Student[]
  progressByStudentId: Record<string, "saved" | "submitted">
  disabled?: boolean
}>();

const studentIdRef = defineModel<string | undefined>();

const groupList = [
  { progress: undefined, label: "Not started" },
  { progress: "saved", label: "Saved" },
  { progress: "submitted", label: "Submitted" }
] as const;

const itemListRef = computed(() => {
  const itemList: SelectMenuItem[] = [];

  for (const group of groupList) {
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
