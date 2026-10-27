<script setup lang="ts">
import type { FormError } from "@nuxt/ui";

import { TestSkillCategoryEnum } from "~/schemas/test-skill.schema";
import { type TestVariant, testVariantSchema } from "~/schemas/test-variant.schema";

type SkillFormState = {
  id: string
  name: string
  category: TestSkillCategoryEnum
  criteria: string
  maxScore: number | undefined
};

type TestFormState = { name: string, skills: SkillFormState[] };

// Creates a test when `test` is omitted, otherwise edits it.
const props = defineProps<{
  test?: TestVariant
}>();

const isOpenRef = defineModel<boolean>("open", { default: false });

const toast = useToast();
const { testVariantListRef, saveTestVariant } = useTestVariantRepository();

const formStateRef = reactive<TestFormState>(createFormState());
// The name sits outside the form, so its error only shows once it has been typed in or a save was attempted.
const isNameTouchedRef = ref(false);
// The name reads as plain text until the pen is clicked; a new test starts with it open.
const isEditingNameRef = ref(false);
const nameInputRef = useTemplateRef("nameInputRef");

function startEditingName() {
  isEditingNameRef.value = true;
  nextTick(() => nameInputRef.value?.inputRef?.focus());
}

// The text is already in the form, so leaving the box only has to close it and show any error.
function stopEditingName() {
  isEditingNameRef.value = false;
  isNameTouchedRef.value = true;
}

function createSkillState(category: TestSkillCategoryEnum): SkillFormState {
  return { id: crypto.randomUUID(), name: "", category, criteria: "", maxScore: 1 };
}

function createFormState(): TestFormState {
  const { test } = props;
  return {
    name: test?.name ?? "",
    skills: test ? test.skills.map(skill => ({ ...skill })) : [createSkillState(TestSkillCategoryEnum.Objective)]
  };
}

// Reset on every open so a cancelled edit doesn't leak into the next one.
watch(isOpenRef, (isOpen) => {
  if (!isOpen) return;
  Object.assign(formStateRef, createFormState());
  isNameTouchedRef.value = false;
  if (props.test) isEditingNameRef.value = false;
  else startEditingName();
});

// Objective skills fill the left column and subjective ones the right.
const skillColumnListRef = computed(() =>
  Object.values(TestSkillCategoryEnum).map(category => ({
    category,
    skillList: formStateRef.skills.filter(skill => skill.category === category)
  })));

// The newest skill goes to the top of its column.
function addSkill(category: TestSkillCategoryEnum) {
  formStateRef.skills.unshift(createSkillState(category));
}

function removeSkill(skillId: string) {
  formStateRef.skills = formStateRef.skills.filter(skill => skill.id !== skillId);
}

// Errors are keyed by position in the full skill list.
function getSkillFieldName(skillId: string, field: keyof SkillFormState) {
  return `skills.${formStateRef.skills.findIndex(skill => skill.id === skillId)}.${field}`;
}

function buildTest() {
  return {
    id: props.test?.id ?? crypto.randomUUID(),
    name: formStateRef.name.trim(),
    skills: formStateRef.skills.map(skill => ({
      id: skill.id,
      name: skill.name.trim(),
      category: skill.category,
      criteria: skill.criteria.trim(),
      maxScore: skill.maxScore ?? Number.NaN
    }))
  };
}

// Schema issues are attached to the field they came from, e.g. "skills.0.name".
function validateForm(): FormError[] {
  const testResult = testVariantSchema.safeParse(buildTest());
  const errorList: FormError[] = testResult.success
    ? []
    : testResult.error.issues.map(issue => ({ name: issue.path.join("."), message: issue.message }));

  const lowerName = formStateRef.name.trim().toLowerCase();
  const isNameTaken = (testVariantListRef.value ?? []).some(test => test.id !== props.test?.id && test.name.toLowerCase() === lowerName);
  if (lowerName && isNameTaken) errorList.push({ name: "name", message: "A test with this name already exists." });
  return errorList;
}

const nameErrorRef = computed(() =>
  isNameTouchedRef.value ? validateForm().find(formError => formError.name === "name")?.message : undefined);

// Skill errors show on their own fields; a test with no skills has no field to show it on.
const skillsErrorRef = computed(() =>
  formStateRef.skills.length === 0 ? "A test needs at least one skill." : undefined);

function showError(title: string, description?: string) {
  toast.add({ title, description, color: "error", icon: "i-lucide-circle-x" });
}

async function handleSave() {
  const testResult = testVariantSchema.safeParse(buildTest());
  if (!testResult.success) {
    showError("Check test details", testResult.error.issues[0]?.message);
    return;
  }

  try {
    await saveTestVariant(testResult.data);
    isOpenRef.value = false;
    toast.add({ title: "Test saved", color: "success", icon: "i-lucide-circle-check" });
  } catch (saveError) {
    console.error("Test save failed:", saveError);
    showError("Couldn't save test", saveError instanceof Error ? saveError.message : undefined);
  }
}
</script>

<template>
  <UModal
    v-model:open="isOpenRef"
    :ui="{ content: 'sm:max-w-4xl h-[80dvh]', body: '[scrollbar-gutter:stable]' }"
  >
    <template #title>
      <UInput
        v-if="isEditingNameRef"
        ref="nameInputRef"
        v-model="formStateRef.name"
        placeholder="Test name"
        aria-label="Test name"
        autofocus
        :color="nameErrorRef ? 'error' : undefined"
        :highlight="!!nameErrorRef"
        class="w-full"
        @blur="stopEditingName"
        @keydown.enter.prevent="stopEditingName"
      />
      <div
        v-else
        class="flex items-center gap-1"
      >
        <span
          class="min-w-0 truncate"
          :class="{ 'text-muted': !formStateRef.name.trim() }"
        >
          {{ formStateRef.name.trim() || "Untitled test" }}
        </span>
        <UButton
          type="button"
          icon="i-lucide-pencil"
          color="neutral"
          variant="ghost"
          size="xs"
          aria-label="Edit test name"
          class="shrink-0"
          @click="startEditingName"
        />
      </div>
      <p
        v-if="nameErrorRef ?? skillsErrorRef"
        class="mt-1 text-xs font-normal text-error"
      >
        {{ nameErrorRef ?? skillsErrorRef }}
      </p>
    </template>

    <template #body>
      <UForm
        id="test-form"
        :state="formStateRef"
        :validate="validateForm"
        :validate-on="['input', 'change']"
        @submit="handleSave"
        @error="isNameTouchedRef = true"
      >
        <div class="grid gap-4 md:grid-cols-2">
          <section
            v-for="skillColumn in skillColumnListRef"
            :key="skillColumn.category"
            class="min-w-0 space-y-2"
          >
            <div class="flex items-center justify-between gap-2">
              <h4 class="text-sm font-medium">
                {{ skillColumn.category }}
                <span class="font-normal text-muted">({{ skillColumn.skillList.length }})</span>
              </h4>
              <UButton
                type="button"
                label="Add skill"
                icon="i-lucide-plus"
                color="neutral"
                variant="outline"
                size="xs"
                @click="addSkill(skillColumn.category)"
              />
            </div>

            <TransitionGroup
              name="skill"
              tag="div"
              class="relative space-y-2"
            >
              <div
                v-for="skill in skillColumn.skillList"
                :key="skill.id"
                class="space-y-2 rounded-md border border-muted p-2"
              >
                <div class="flex items-start gap-2">
                  <UFormField
                    :name="getSkillFieldName(skill.id, 'name')"
                    class="min-w-0 flex-1"
                  >
                    <UInput
                      v-model="skill.name"
                      placeholder="Skill name"
                      aria-label="Skill name"
                      size="sm"
                      class="w-full"
                    />
                  </UFormField>
                  <UFormField
                    :name="getSkillFieldName(skill.id, 'maxScore')"
                    class="w-16 shrink-0"
                  >
                    <UInputNumber
                      v-model="skill.maxScore"
                      :min="0"
                      :increment="false"
                      :decrement="false"
                      placeholder="Max"
                      aria-label="Max score"
                      size="sm"
                      :ui="{ base: 'text-center' }"
                      class="w-full"
                    />
                  </UFormField>
                </div>
                <div class="flex items-start gap-1">
                  <UFormField
                    :name="getSkillFieldName(skill.id, 'criteria')"
                    class="min-w-0 flex-1"
                  >
                    <UTextarea
                      v-model="skill.criteria"
                      placeholder="Criteria"
                      aria-label="Criteria"
                      :rows="1"
                      autoresize
                      size="sm"
                      class="w-full"
                    />
                  </UFormField>
                  <UButton
                    type="button"
                    icon="i-lucide-x"
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    aria-label="Remove skill"
                    class="shrink-0"
                    @click="removeSkill(skill.id)"
                  />
                </div>
              </div>
            </TransitionGroup>
          </section>
        </div>
      </UForm>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          type="button"
          label="Cancel"
          color="neutral"
          variant="outline"
          @click="isOpenRef = false"
        />
        <UButton
          type="submit"
          form="test-form"
          label="Save"
          loading-auto
        />
      </div>
    </template>
  </UModal>
</template>

<style scoped>
/* A new skill fades in at the top while the ones below slide down to make room. */
.skill-enter-active,
.skill-leave-active,
.skill-move {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.skill-enter-from,
.skill-leave-to {
  opacity: 0;
  transform: translateY(-0.5rem);
}

/* Taken out of the flow so the skills below close up smoothly. */
.skill-leave-active {
  position: absolute;
  width: 100%;
}

@media (prefers-reduced-motion: reduce) {
  .skill-enter-active,
  .skill-leave-active,
  .skill-move {
    transition: none;
  }
}
</style>
