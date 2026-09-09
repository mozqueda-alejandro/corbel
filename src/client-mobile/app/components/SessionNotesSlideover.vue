<script setup lang="ts">
import { useDebounceFn } from "@vueuse/core";

import { type Note, NoteColor } from "~/schemas/note.schema";

const props = defineProps<{
  sessionId: string
}>();

const isOpenRef = defineModel<boolean>("open", { required: true });

const { getNotesBySessionId, createNote, updateNote, deleteNote } = useNoteRepository();
const noteListForSessionRef = getNotesBySessionId(props.sessionId);

const noteColorOptionList = Object.values(NoteColor);

const newTagTextByNoteIdRef = ref<Record<string, string>>({});

async function handleCreateNote() {
  await createNote(props.sessionId);
}

const persistNoteUpdate = useDebounceFn(async (noteData: Note) => {
  await updateNote(noteData);
}, 300);

function handleNoteTextInput(noteData: Note) {
  persistNoteUpdate(noteData);
}

async function handleNoteColorChange(noteData: Note, newColor: NoteColor) {
  await updateNote({ ...noteData, color: newColor });
}

async function handleAddTag(noteData: Note) {
  const newTagText = (newTagTextByNoteIdRef.value[noteData.id] ?? "").trim();
  if (!newTagText || noteData.tags.includes(newTagText)) return;

  await updateNote({ ...noteData, tags: [...noteData.tags, newTagText] });
  newTagTextByNoteIdRef.value[noteData.id] = "";
}

async function handleRemoveTag(noteData: Note, tagToRemove: string) {
  await updateNote({ ...noteData, tags: noteData.tags.filter(tagItem => tagItem !== tagToRemove) });
}

async function handleDeleteNote(noteId: string) {
  await deleteNote(noteId);
}
</script>

<template>
  <USlideover
    v-model:open="isOpenRef"
    title="Session Notes"
    description="Unsorted notes for this session."
  >
    <template #body>
      <div class="space-y-3">
        <UButton
          icon="i-lucide-plus"
          color="neutral"
          variant="outline"
          block
          @click="handleCreateNote"
        >
          New note
        </UButton>

        <p
          v-if="!noteListForSessionRef.length"
          class="text-sm text-muted text-center py-6"
        >
          No notes yet — add one above.
        </p>

        <UCard
          v-for="noteItem in noteListForSessionRef"
          :key="noteItem.id"
          :ui="{ root: `border-s-4 border-s-${noteItem.color}` }"
        >
          <div class="space-y-2">
            <UTextarea
              :model-value="noteItem.text"
              placeholder="Write a note..."
              autoresize
              :rows="2"
              class="w-full"
              :ui="{ base: 'ring-0 focus:ring-0 shadow-none px-0' }"
              @update:model-value="(newText: string) => handleNoteTextInput({ ...noteItem, text: newText })"
            />

            <div class="flex flex-wrap items-center gap-1">
              <UBadge
                v-for="tagItem in noteItem.tags"
                :key="tagItem"
                :label="tagItem"
                variant="subtle"
                color="neutral"
                class="cursor-pointer"
                @click="handleRemoveTag(noteItem, tagItem)"
              >
                {{ tagItem }}
                <template #trailing>
                  <UIcon
                    name="i-lucide-x"
                    class="size-3"
                  />
                </template>
              </UBadge>

              <UInput
                v-model="newTagTextByNoteIdRef[noteItem.id]"
                placeholder="Add tag..."
                size="xs"
                variant="none"
                class="w-24"
                @keyup.enter="handleAddTag(noteItem)"
                @blur="handleAddTag(noteItem)"
              />
            </div>

            <div class="flex items-center justify-between pt-1">
              <div class="flex items-center gap-1">
                <UButton
                  v-for="colorOption in noteColorOptionList"
                  :key="colorOption"
                  :color="colorOption"
                  size="2xs"
                  :variant="noteItem.color === colorOption ? 'solid' : 'soft'"
                  class="size-4 p-0 rounded-full"
                  :aria-label="`Set note color to ${colorOption}`"
                  @click="handleNoteColorChange(noteItem, colorOption)"
                />
              </div>

              <UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="xs"
                aria-label="Delete note"
                @click="handleDeleteNote(noteItem.id)"
              />
            </div>
          </div>
        </UCard>
      </div>
    </template>
  </USlideover>
</template>
