<script setup lang="ts">
import { MAX_PHOTOS_PER_STUDENT, MAX_TAGS_PER_PHOTO, type Session } from "~/schemas/session.schema";

// readonly is set for completed and archived sessions.
const props = defineProps<{
  session: Session
  studentId?: string
  readonly?: boolean
}>();

const toast = useToast();
const database = useDatabase();
const { studentListRef } = useStudentRepository();
const { dailySkillListRef } = useDailySkillRepository();
const { addSessionPhotoList, updateSessionPhotoTagList, deleteSessionPhoto } = useSessionRepository();

const fileInputRef = useTemplateRef("fileInputRef");
const isAddingRef = ref(false);
const previewPhotoIdRef = ref<string>();
const photoToDeleteIdRef = ref<string>();

//region Photos
const photoCountRef = computed(() =>
  props.session.photos.filter(photo => photo.studentId === props.studentId).length);
const isFullRef = computed(() => photoCountRef.value >= MAX_PHOTOS_PER_STUDENT);

const { data: photoRowListRef } = useLiveQuery(
  async () => {
    if (!props.studentId) return [];
    const photoRowList = await database.photoTable.where("[sessionId+studentId]").equals([props.session.id, props.studentId]).toArray();
    return photoRowList.sort((photoA, photoB) => photoA.createdAt.getTime() - photoB.createdAt.getTime());
  },
  [() => props.session.id, () => props.studentId]
);

const thumbnailListRef = shallowRef<{ id: string, url: string }[]>([]);

watch(photoRowListRef, (photoRowList, _previousPhotoRowList, onCleanup) => {
  const thumbnailList = (photoRowList ?? []).map(photoRow => ({ id: photoRow.id, url: URL.createObjectURL(photoRow.blob) }));
  thumbnailListRef.value = thumbnailList;
  onCleanup(() => thumbnailList.forEach(thumbnail => URL.revokeObjectURL(thumbnail.url)));
}, { immediate: true });

const previewUrlRef = computed(() => thumbnailListRef.value.find(thumbnail => thumbnail.id === previewPhotoIdRef.value)?.url);
const previewIndexRef = computed(() => thumbnailListRef.value.findIndex(thumbnail => thumbnail.id === previewPhotoIdRef.value));
const hasPreviousPhotoRef = computed(() => previewIndexRef.value > 0);
const hasNextPhotoRef = computed(() => previewIndexRef.value >= 0 && previewIndexRef.value < thumbnailListRef.value.length - 1);

function showAdjacentPhoto(offset: -1 | 1) {
  const adjacentThumbnail = thumbnailListRef.value[previewIndexRef.value + offset];
  if (adjacentThumbnail) previewPhotoIdRef.value = adjacentThumbnail.id;
}

const SWIPE_THRESHOLD_PX = 50;
let swipeStartX: number | undefined;

function handleSwipeStart(pointerEvent: PointerEvent) {
  swipeStartX = pointerEvent.clientX;
}

// Swiping left shows the next photo, swiping right the previous one.
function handleSwipeEnd(pointerEvent: PointerEvent) {
  if (swipeStartX === undefined) return;
  const deltaX = pointerEvent.clientX - swipeStartX;
  swipeStartX = undefined;
  if (Math.abs(deltaX) >= SWIPE_THRESHOLD_PX) showAdjacentPhoto(deltaX < 0 ? 1 : -1);
}

const previewPhotoRef = computed(() => props.session.photos.find(photo => photo.id === previewPhotoIdRef.value));

const previewTitleRef = computed(() => {
  const previewPhoto = previewPhotoRef.value;
  if (!previewPhoto) return "Photo";

  const student = studentListRef.value?.find(studentItem => studentItem.id === previewPhoto.studentId);
  return student ? `${student.firstName} ${student.lastName}`.trim() : "Student";
});

const previewTakenAtRef = computed(() => {
  const previewPhoto = previewPhotoRef.value;
  if (!previewPhoto) return "";
  return new Date(previewPhoto.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
});

// Unselected skills are disabled once the photo has the maximum number of tags.
const skillTagOptionListRef = computed(() => {
  const selectedTagList = previewPhotoRef.value?.tags ?? [];
  const isTagLimitReached = selectedTagList.length >= MAX_TAGS_PER_PHOTO;
  return (dailySkillListRef.value ?? []).map(dailySkill => ({
    label: dailySkill.name,
    value: dailySkill.name,
    disabled: isTagLimitReached && !selectedTagList.includes(dailySkill.name)
  }));
});

const emptyMessageRef = computed(() => {
  if (!props.studentId) return "Select a student to add photos.";
  if (props.readonly && photoCountRef.value === 0) return "No photos.";
  return "";
});
//endregion

//region Adding
function showError(title: string, errorValue?: unknown) {
  toast.add({
    title,
    description: errorValue instanceof Error ? errorValue.message : undefined,
    color: "error",
    icon: "i-lucide-circle-x"
  });
}

async function handleFilesSelected(fileInputEvent: Event) {
  const fileInput = fileInputEvent.target as HTMLInputElement;
  const selectedFileList = Array.from(fileInput.files ?? []);
  fileInput.value = "";
  if (selectedFileList.length === 0 || !props.studentId || props.readonly) return;

  const remainingSlotCount = MAX_PHOTOS_PER_STUDENT - photoCountRef.value;
  const acceptedFileList = selectedFileList.slice(0, Math.max(0, remainingSlotCount));
  if (acceptedFileList.length < selectedFileList.length) {
    toast.add({
      title: `Only ${acceptedFileList.length} of ${selectedFileList.length} photos added`,
      description: `The limit is ${MAX_PHOTOS_PER_STUDENT} photos per student.`,
      color: "warning",
      icon: "i-lucide-triangle-alert"
    });
  }

  isAddingRef.value = true;
  try {
    // Browsers may evict IndexedDB for sites that aren't visited for a while; the answer is best-effort.
    void navigator.storage?.persist?.();

    const photoBlobList: Blob[] = [];
    let unreadableCount = 0;
    for (const acceptedFile of acceptedFileList) {
      try {
        photoBlobList.push(await resizeImageToJpeg(acceptedFile));
      } catch {
        unreadableCount++;
      }
    }
    if (unreadableCount > 0) showError(`${unreadableCount} ${unreadableCount === 1 ? "photo" : "photos"} couldn't be read`);

    if (photoBlobList.length > 0) await addSessionPhotoList(props.session.id, props.studentId, photoBlobList);
  } catch (addError) {
    console.error("Adding photos failed:", addError);
    showError("Couldn't save photos", addError);
  } finally {
    isAddingRef.value = false;
  }
}
//endregion

//region Tagging
async function handleTagListChange(tagList: string[]) {
  const previewPhotoId = previewPhotoIdRef.value;
  if (!previewPhotoId || props.readonly) return;

  try {
    await updateSessionPhotoTagList(props.session.id, previewPhotoId, tagList.slice(0, MAX_TAGS_PER_PHOTO));
  } catch (tagError) {
    console.error("Updating photo tags failed:", tagError);
    showError("Couldn't update tags", tagError);
  }
}
//endregion

//region Deleting
async function handleConfirmDelete() {
  const photoId = photoToDeleteIdRef.value;
  photoToDeleteIdRef.value = undefined;
  if (!photoId) return;

  try {
    await deleteSessionPhoto(props.session.id, photoId);
  } catch (deleteError) {
    console.error("Deleting photo failed:", deleteError);
    showError("Couldn't delete photo", deleteError);
  }
}
//endregion
</script>

<template>
  <UFormField
    label="Photos"
    :hint="`${photoCountRef}/${MAX_PHOTOS_PER_STUDENT}`"
  >
    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      multiple
      class="hidden"
      @change="handleFilesSelected"
    >

    <div class="grid grid-cols-[repeat(auto-fill,minmax(5rem,1fr))] gap-2">
      <button
        v-if="!readonly"
        type="button"
        :disabled="!studentId || isFullRef || isAddingRef"
        class="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed border-accented text-muted transition-colors enabled:hover:bg-elevated/50 disabled:cursor-not-allowed disabled:opacity-50"
        @click="fileInputRef?.click()"
      >
        <UIcon
          :name="isAddingRef ? 'i-lucide-loader-circle' : 'i-lucide-camera'"
          class="size-5"
          :class="{ 'animate-spin': isAddingRef }"
        />
        <span class="text-xs">{{ isAddingRef ? "Saving" : "Add photo" }}</span>
      </button>

      <div
        v-for="thumbnail in thumbnailListRef"
        :key="thumbnail.id"
        class="relative aspect-square"
      >
        <button
          type="button"
          class="size-full overflow-hidden rounded-md border border-muted"
          aria-label="View photo"
          @click="previewPhotoIdRef = thumbnail.id"
        >
          <img
            :src="thumbnail.url"
            alt="Student photo"
            class="size-full object-cover"
          >
        </button>
        <UButton
          v-if="!readonly"
          type="button"
          icon="i-lucide-x"
          color="neutral"
          size="xs"
          class="absolute right-1 top-1 rounded-full"
          aria-label="Delete photo"
          @click="photoToDeleteIdRef = thumbnail.id"
        />
      </div>

      <p
        v-if="emptyMessageRef"
        class="col-span-full text-sm text-muted"
      >
        {{ emptyMessageRef }}
      </p>
    </div>

    <UModal
      :open="!!previewPhotoIdRef"
      :title="previewTitleRef"
      :description="previewTakenAtRef"
      :ui="{ content: 'sm:max-w-2xl' }"
      @update:open="previewPhotoIdRef = undefined"
    >
      <template #body>
        <div class="space-y-3">
          <div class="flex items-center gap-2">
            <UButton
              class="rounded-full"
              size="sm"
              type="button"
              icon="i-lucide-chevron-left"
              color="neutral"
              variant="soft"
              aria-label="Previous photo"
              :disabled="!hasPreviousPhotoRef"
              @click="showAdjacentPhoto(-1)"
            />
            <div
              class="min-w-0 flex-1 touch-pan-y"
              @pointerdown="handleSwipeStart"
              @pointerup="handleSwipeEnd"
              @pointercancel="swipeStartX = undefined"
            >
              <img
                v-if="previewUrlRef"
                :src="previewUrlRef"
                alt="Student photo"
                draggable="false"
                class="max-h-[calc(100dvh-26rem)] min-h-32 w-full rounded-md object-contain"
              >
            </div>
            <UButton
              class="rounded-full"
              size="sm"
              type="button"
              icon="i-lucide-chevron-right"
              color="neutral"
              variant="soft"
              aria-label="Next photo"
              :disabled="!hasNextPhotoRef"
              @click="showAdjacentPhoto(1)"
            />
          </div>
          <p class="text-center text-sm text-muted">
            {{ previewIndexRef + 1 }}/{{ thumbnailListRef.length }}
          </p>
          <UFormField
            label="Tags"
          >
            <UInputMenu
              :model-value="previewPhotoRef?.tags ?? []"
              multiple
              value-key="value"
              :items="skillTagOptionListRef"
              placeholder="Add skill tags"
              :disabled="readonly"
              class="w-full"
              @update:model-value="handleTagListChange"
            />
          </UFormField>
        </div>
      </template>
    </UModal>

    <UModal
      :open="!!photoToDeleteIdRef"
      title="Delete photo?"
      description="This photo will be removed from the session."
      @update:open="photoToDeleteIdRef = undefined"
    >
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            type="button"
            label="Cancel"
            color="neutral"
            variant="outline"
            @click="photoToDeleteIdRef = undefined"
          />
          <UButton
            type="button"
            label="Delete"
            color="error"
            @click="handleConfirmDelete"
          />
        </div>
      </template>
    </UModal>
  </UFormField>
</template>
