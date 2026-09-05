<script setup lang="ts">
import { type Task, db } from "../utils/db";

type NewTask = Omit<Task, "id">;

const newTaskTitle = ref("");
const { data: tasks, error } = useLiveQuery<Task[]>(() => db.tasks.toArray());

const editingTaskId = ref<number | null>(null);
const editingTitle = ref("");
const editInputRef = useTemplateRef("editInputRef");

async function addTask(): Promise<void> {
  const title = newTaskTitle.value.trim();
  if (!title) return;

  const existing = await db.tasks.where("title").equals(title).first();
  if (existing) return;

  const newTask: NewTask = { title, done: false };
  await db.tasks.add(newTask as Task);
  newTaskTitle.value = "";
}

function startEditing(task: Task): void {
  editingTaskId.value = task.id;
  editingTitle.value = task.title;
}

function cancelEditing(): void {
  editingTaskId.value = null;
}

async function commitEdit(): Promise<void> {
  if (editingTaskId.value === null) return;

  const title = editingTitle.value.trim();
  if (title) {
    await db.tasks.update(editingTaskId.value, { title });
  }
  editingTaskId.value = null;
}

async function toggleTask(task: Task): Promise<void> {
  await db.tasks.update(task.id, { done: !task.done });
}

async function deleteTask(task: Task): Promise<void> {
  await db.tasks.delete(task.id);
}
</script>

<template>
  <div class="flex gap-2">
    <UInput
      v-model="newTaskTitle"
      placeholder="New task"
      @keyup.enter="addTask"
    />
    <UButton
      label="Add"
      @click="addTask"
    />
  </div>

  <p v-if="error">
    Failed to load tasks: {{ String(error) }}
  </p>

  <ul
    v-else
    class="mt-4 space-y-2"
  >
    <li
      v-for="task in tasks"
      :key="task.id"
      class="flex items-center gap-2"
    >
      <UCheckbox
        :model-value="task.done"
        @update:model-value="toggleTask(task)"
      />
      <UInput
        v-if="task.id === editingTaskId"
        ref="editInputRef"
        v-model="editingTitle"
        @keyup.enter="commitEdit"
      />
      <span v-else>
        {{ task.title }} - {{ task.id }}
      </span>
      <UButton
        :icon="task.id === editingTaskId ? 'i-lucide-x' : 'i-lucide-pencil'"
        color="neutral"
        variant="ghost"
        @click="task.id === editingTaskId ? cancelEditing() : startEditing(task)"
      />
      <UButton
        icon="i-lucide-trash"
        color="error"
        variant="ghost"
        @click="deleteTask(task)"
      />
    </li>
  </ul>
</template>
