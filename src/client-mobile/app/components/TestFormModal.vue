<script setup lang="ts">
import type { FormError } from "@nuxt/ui";

import { SPECIAL_SKILL_MAX_SCORE } from "~/schemas/session.schema";
import { TestSkillCategoryEnum } from "~/schemas/test-skill.schema";
import { MAX_SPECIAL_SKILLS, type TestVariant, testVariantSchema } from "~/schemas/test-variant.schema";

type SkillFormState = {
  id: string
  name: string
  category: TestSkillCategoryEnum
  criteria: string
  maxScore: number | undefined
};

type TestFormState = { name: string, skills: SkillFormState[], specialSkillCount: number };

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

// The skill whose popup is open. Its fields edit the form state directly, so the popup has no buttons;
// the changes are saved along with the test.
const editingSkillIdRef = ref<string>();
const isSkillModalOpenRef = computed({
  get: () => !!editingSkillIdRef.value,
  set: (isOpen) => {
    if (!isOpen) editingSkillIdRef.value = undefined;
  }
});
const editingSkillRef = computed(() => formStateRef.skills.find(skill => skill.id === editingSkillIdRef.value));

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
    skills: test ? test.skills.map(skill => ({ ...skill })) : [createSkillState(TestSkillCategoryEnum.Objective)],
    specialSkillCount: test?.specialSkillCount ?? 1
  };
}

// Reset on every open so a cancelled edit doesn't leak into the next one.
watch(isOpenRef, (isOpen) => {
  if (!isOpen) return;
  Object.assign(formStateRef, createFormState());
  isNameTouchedRef.value = false;
  editingSkillIdRef.value = undefined;
  if (props.test) isEditingNameRef.value = false;
  else startEditingName();
});

// Skills grouped under their category, in the enum's order, with the points available per group.
const skillGroupListRef = computed(() =>
  Object.values(TestSkillCategoryEnum).map((category) => {
    const skillList = formStateRef.skills.filter(skill => skill.category === category);
    return {
      category,
      label: `${category} Evaluation`,
      skillList,
      maxScore: skillList.reduce((maxSum, skill) => maxSum + (skill.maxScore ?? 0), 0)
    };
  }));

// The new skill goes to the end of its group and opens its popup so it can be filled in straight away.
function addSkill(category: TestSkillCategoryEnum) {
  const skill = createSkillState(category);
  formStateRef.skills.push(skill);
  editingSkillIdRef.value = skill.id;
}

function removeSkill(skillId: string) {
  editingSkillIdRef.value = undefined;
  formStateRef.skills = formStateRef.skills.filter(skill => skill.id !== skillId);
}

// Special skills carry no details here; their name and criteria are written in for each student when scoring.
function addSpecialSkill() {
  formStateRef.specialSkillCount = Math.min(formStateRef.specialSkillCount + 1, MAX_SPECIAL_SKILLS);
}

function removeSpecialSkill() {
  formStateRef.specialSkillCount = Math.max(formStateRef.specialSkillCount - 1, 0);
}

function buildTest() {
  return {
    id: props.test?.id ?? crypto.randomUUID(),
    name: formStateRef.name.trim(),
    specialSkillCount: formStateRef.specialSkillCount,
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

// Errors are keyed by position in the full skill list.
const skillErrorListByIdRef = computed(() => {
  const skillErrorListById = new Map<string, FormError[]>();
  for (const formError of validateForm()) {
    const [scope, skillIndex] = (formError.name ?? "").split(".");
    const skill = scope === "skills" ? formStateRef.skills[Number(skillIndex)] : undefined;
    if (skill) skillErrorListById.set(skill.id, [...(skillErrorListById.get(skill.id) ?? []), formError]);
  }
  return skillErrorListById;
});

function getSkillFieldError(skillId: string, field: keyof SkillFormState) {
  return skillErrorListByIdRef.value.get(skillId)?.find(formError => formError.name?.endsWith(`.${field}`))?.message;
}

const nameErrorRef = computed(() =>
  isNameTouchedRef.value ? validateForm().find(formError => formError.name === "name")?.message : undefined);

// Skill errors show on their own rows; a test with no skills has no row to show it on.
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
    :ui="{ content: 'sm:max-w-2xl h-[80dvh]', body: '[scrollbar-gutter:stable]', wrapper: 'min-w-0 flex-1 pe-10', title: 'w-full' }"
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
        class="flex h-8 items-center gap-1"
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
        <div class="overflow-hidden rounded-md border border-muted">
          <template
            v-for="skillGroup in skillGroupListRef"
            :key="skillGroup.category"
          >
            <div class="flex items-center gap-3 border-t border-muted bg-elevated/50 px-4 py-2 first:border-t-0">
              <h3 class="text-sm font-semibold">
                {{ skillGroup.label }}
              </h3>
              <span class="me-auto text-sm text-muted">
                {{ skillGroup.maxScore }} pts
              </span>
              <UButton
                type="button"
                label="Add skill"
                icon="i-lucide-plus"
                color="neutral"
                variant="outline"
                size="xs"
                @click="addSkill(skillGroup.category)"
              />
            </div>
            <div
              v-for="skill in skillGroup.skillList"
              :key="skill.id"
              class="flex items-center gap-2 border-t border-muted py-1.5 pl-2 pr-4"
            >
              <UButton
                type="button"
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                size="sm"
                :aria-label="`Edit ${skill.name || 'skill'}`"
                @click="editingSkillIdRef = skill.id"
              />
              <div class="min-w-0 flex-1">
                <span
                  class="block truncate font-medium"
                  :class="{ 'text-muted': !skill.name.trim(), 'text-error': skillErrorListByIdRef.has(skill.id) }"
                >
                  {{ skill.name.trim() || "Untitled skill" }}
                </span>
                <span
                  v-if="skill.criteria"
                  class="block text-xs text-muted"
                >
                  {{ skill.criteria }}
                </span>
              </div>
              <span class="shrink-0 text-sm text-muted">
                {{ skill.maxScore ?? "?" }} pts
              </span>
            </div>
            <p
              v-if="skillGroup.skillList.length === 0"
              class="border-t border-muted px-4 py-3 text-sm text-muted"
            >
              No {{ skillGroup.category.toLowerCase() }} skills.
            </p>
          </template>

          <div class="flex items-center gap-3 border-t border-muted bg-elevated/50 px-4 py-2">
            <h3 class="text-sm font-semibold">
              Special Skills
            </h3>
            <span class="me-auto text-sm text-muted">
              {{ formStateRef.specialSkillCount * SPECIAL_SKILL_MAX_SCORE }} pts
            </span>
            <UButton
              type="button"
              label="Add skill"
              icon="i-lucide-plus"
              color="neutral"
              variant="outline"
              size="xs"
              :disabled="formStateRef.specialSkillCount >= MAX_SPECIAL_SKILLS"
              @click="addSpecialSkill"
            />
          </div>
          <div
            v-for="specialSkillIndex in formStateRef.specialSkillCount"
            :key="specialSkillIndex"
            class="flex items-center gap-2 border-t border-muted py-1.5 pl-2 pr-4"
          >
            <UButton
              v-if="specialSkillIndex === formStateRef.specialSkillCount"
              type="button"
              icon="i-lucide-trash-2"
              color="neutral"
              variant="ghost"
              size="sm"
              aria-label="Remove special skill"
              @click="removeSpecialSkill"
            />
            <span
              v-else
              class="size-8 shrink-0"
            />
            <span class="min-w-0 flex-1 truncate font-medium">
              Special Skill
            </span>
            <span class="shrink-0 text-sm text-muted">
              {{ SPECIAL_SKILL_MAX_SCORE }} pts
            </span>
          </div>
          <p
            v-if="formStateRef.specialSkillCount === 0"
            class="border-t border-muted px-4 py-3 text-sm text-muted"
          >
            No special skills.
          </p>
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

  <!-- Edits go straight into the form and are saved with the test, so the popup has no confirm or cancel buttons. -->
  <UModal
    v-model:open="isSkillModalOpenRef"
    title="Edit skill"
  >
    <template #body>
      <div
        v-if="editingSkillRef"
        class="space-y-3"
      >
        <UFormField
          label="Name"
          :error="getSkillFieldError(editingSkillRef.id, 'name')"
        >
          <UInput
            v-model="editingSkillRef.name"
            placeholder="Skill name"
            aria-label="Skill name"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Criteria"
          :error="getSkillFieldError(editingSkillRef.id, 'criteria')"
        >
          <UTextarea
            v-model="editingSkillRef.criteria"
            placeholder="Criteria"
            aria-label="Criteria"
            :rows="3"
            autoresize
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Max score"
          :error="getSkillFieldError(editingSkillRef.id, 'maxScore')"
        >
          <UInputNumber
            v-model="editingSkillRef.maxScore"
            :min="0"
            :increment="false"
            :decrement="false"
            placeholder="Max"
            aria-label="Max score"
            :ui="{ base: 'text-center' }"
            class="w-28"
          />
        </UFormField>
        <UButton
          type="button"
          label="Delete skill"
          icon="i-lucide-trash-2"
          color="error"
          variant="link"
          class="px-0"
          @click="removeSkill(editingSkillRef.id)"
        />
      </div>
    </template>
  </UModal>
</template>
