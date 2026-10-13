<script setup lang="ts">
// The label sits inside the draggable row so a finger sliding it doesn't cover the value.
const props = defineProps<{
  label: string
  min: number
  max: number
  size?: "xs" | "sm" | "md" | "lg" | "xl"
  disabled?: boolean
}>();

const modelValue = defineModel<number | undefined>();

const PIXELS_PER_STEP = 24;
const DRAG_START_THRESHOLD_PX = 4;

const inputRef = useTemplateRef("inputRef");
const { currentUserSettingsRef } = useUserRepository();

let dragOrigin: { pointerId: number, startX: number, startValue: number | undefined, isDragging: boolean } | undefined;

//region Drag
function handlePointerDown(pointerEvent: PointerEvent) {
  if (props.disabled) return;
  // Audio and haptics are only allowed to start from a user gesture, so they are warmed up here.
  void primeFeedback();
  dragOrigin = { pointerId: pointerEvent.pointerId, startX: pointerEvent.clientX, startValue: modelValue.value, isDragging: false };
}

function handlePointerMove(pointerEvent: PointerEvent) {
  if (!dragOrigin) return;

  const deltaX = pointerEvent.clientX - dragOrigin.startX;
  if (!dragOrigin.isDragging) {
    if (Math.abs(deltaX) < DRAG_START_THRESHOLD_PX) return;
    // Capturing only once a drag starts keeps a plain tap focusing the input.
    dragOrigin.isDragging = true;
    (pointerEvent.currentTarget as HTMLElement).setPointerCapture(dragOrigin.pointerId);
    inputRef.value?.inputRef?.blur();
  }
  clearTextSelection();

  // An empty field starts dragging from the middle of the range.
  const startValue = dragOrigin.startValue ?? Math.round((props.min + props.max) / 2);
  const nextValue = startValue + Math.round(deltaX / PIXELS_PER_STEP);
  const clampedValue = Math.min(props.max, Math.max(props.min, nextValue));
  if (clampedValue !== modelValue.value) {
    const { haptics, sound } = currentUserSettingsRef.value.feedback;
    if (haptics) triggerHaptic();
    if (sound) triggerSound();
  }
  modelValue.value = clampedValue;
}

function handlePointerEnd(pointerEvent: PointerEvent) {
  // A tap on the label or row padding focuses the input just like a tap on the input itself.
  const isTap = dragOrigin && !dragOrigin.isDragging && pointerEvent.type === "pointerup";
  dragOrigin = undefined;
  if (isTap && !props.disabled && pointerEvent.target !== inputRef.value?.inputRef) inputRef.value?.inputRef?.focus();
}

// A mouse press selects the number before the drag threshold is reached, so the selection is cleared as the drag runs.
function clearTextSelection() {
  window.getSelection()?.removeAllRanges();
  const nativeInput = inputRef.value?.inputRef;
  nativeInput?.setSelectionRange(nativeInput.value.length, nativeInput.value.length);
}

function handleSelectStart(selectEvent: Event) {
  if (dragOrigin?.isDragging) selectEvent.preventDefault();
}
//endregion

//region Typing
function handleTextUpdate(rawText: string | number) {
  const digitText = String(rawText).replace(/\D/g, "");

  let nextValue: number | undefined;
  if (digitText === "") {
    nextValue = undefined;
  } else {
    nextValue = Number(digitText);
    // Typing a second digit replaces the first rather than producing an out-of-range number.
    if (nextValue > props.max) nextValue = Number(digitText.slice(-1));
    if (nextValue < props.min || nextValue > props.max) nextValue = modelValue.value;
  }

  modelValue.value = nextValue;
  // Rejected or normalised text must be written back because the model may not have changed.
  nextTick(() => {
    const nativeInput = inputRef.value?.inputRef;
    if (nativeInput) nativeInput.value = nextValue === undefined ? "" : String(nextValue);
  });
}
//endregion
</script>

<template>
  <div
    class="flex touch-pan-y items-center justify-between gap-3 px-4 py-1.5"
    :class="disabled ? '' : 'cursor-ew-resize'"
    @pointerdown="handlePointerDown"
    @pointermove="handlePointerMove"
    @pointerup="handlePointerEnd"
    @pointercancel="handlePointerEnd"
    @selectstart="handleSelectStart"
  >
    <span class="min-w-0 select-none truncate font-medium">
      {{ label }}
    </span>
    <UInput
      ref="inputRef"
      :size="size"
      :aria-label="`${label} score`"
      class="w-28"
      :model-value="modelValue === undefined ? '' : String(modelValue)"
      type="text"
      inputmode="numeric"
      pattern="[0-9]*"
      enterkeyhint="done"
      autocomplete="off"
      icon="i-lucide-move-horizontal"
      :disabled="disabled"
      :ui="{ base: 'text-center cursor-ew-resize' }"
      @update:model-value="handleTextUpdate"
    />
  </div>
</template>
