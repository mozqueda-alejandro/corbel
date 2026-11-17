<script setup lang="ts">
import { WRITTEN_TEST_SCORE_MAX } from "~/schemas/session.schema";

defineProps<{
  disabled?: boolean
}>();

// Shared by every student taking the Written Test in the session.
const description = defineModel<string>("description", { default: "" });
const score = defineModel<number | undefined>("score");

// Digits only; a value above the maximum is rejected and the box is rewritten with the last good score.
function handleScoreUpdate(rawText: string | number) {
  const digitText = String(rawText).replace(/\D/g, "");
  const nextScore = digitText === "" ? undefined : Number(digitText);
  score.value = nextScore !== undefined && nextScore > WRITTEN_TEST_SCORE_MAX ? score.value : nextScore;

  nextTick(() => {
    const nativeInput = scoreInputRef.value?.inputRef;
    if (nativeInput) nativeInput.value = score.value === undefined ? "" : String(score.value);
  });
}

const scoreInputRef = useTemplateRef("scoreInputRef");
</script>

<template>
  <div class="space-y-4 rounded-md border border-muted p-4">
    <UFormField
      label="Description"
      description="Shown for every student who takes the Written Test in this session."
    >
      <UTextarea
        v-model="description"
        placeholder="Description"
        :maxlength="300"
        :rows="2"
        autoresize
        :disabled="disabled"
        class="w-full"
      />
    </UFormField>

    <UFormField :label="`Score (0-${WRITTEN_TEST_SCORE_MAX})`">
      <UInput
        ref="scoreInputRef"
        :model-value="score === undefined ? '' : String(score)"
        type="text"
        inputmode="numeric"
        pattern="[0-9]*"
        enterkeyhint="done"
        autocomplete="off"
        placeholder="0"
        :disabled="disabled"
        class="w-28"
        @update:model-value="handleScoreUpdate"
      />
    </UFormField>
  </div>
</template>
