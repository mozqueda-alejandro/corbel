<script setup lang="ts">
import type { SelectItem } from "@nuxt/ui";

import { type Session, SPECIAL_SKILL_MAX_SCORE, type SpecialSkill, type TestSkillScore, WRITTEN_TEST_NAME } from "~/schemas/session.schema";
import { TestSkillCategoryEnum } from "~/schemas/test-skill.schema";

// The Written Test is built in, so it has no stored test to take an id from.
const WRITTEN_TEST_ID = "written-test";

//region Props and Composables
// readonly is set for completed and archived sessions.
const props = defineProps<{
  session: Session
  readonly?: boolean
}>();

const toast = useToast();
const { attendingStudentListRef } = useAttendingStudentList(() => props.session);
const { sessionTestVariantListRef } = useSessionTestVariantList(() => props.session);
const { saveSessionTestRecord, saveSessionWrittenTestRecord, saveSessionEdit } = useSessionRepository();

function showSaveError(title: string, saveError: unknown) {
  console.error(`${title}:`, saveError);
  toast.add({
    title,
    description: saveError instanceof Error ? saveError.message : undefined,
    color: "error",
    icon: "i-lucide-circle-x"
  });
}
//endregion

//region Record
// Unlike Dailies there is no Save button: every edit is written straight to the session.
type RecordState = {
  // WRITTEN_TEST_ID for the Written Test, otherwise the id of a test.
  testVariantId?: string
  skills: TestSkillScore[]
  // One entry per special skill of the selected test, filled in as the student is scored.
  specialSkillList: SpecialSkill[]
  writtenScore?: number
};

function createEmptySpecialSkill(): SpecialSkill {
  return { name: "", criteria: "", score: undefined };
}

const studentIdRef = ref<string>();
const recordStateRef = reactive<RecordState>({
  testVariantId: undefined,
  skills: [],
  specialSkillList: [],
  writtenScore: undefined
});

const isWrittenTestRef = computed(() => recordStateRef.testVariantId === WRITTEN_TEST_ID);

function loadRecord(studentId: string | undefined) {
  const storedWrittenRecord = props.session.writtenTests.find(writtenRecord => writtenRecord.studentId === studentId);
  const storedRecord = props.session.tests.find(testRecord => testRecord.studentId === studentId);

  recordStateRef.testVariantId = storedWrittenRecord ? WRITTEN_TEST_ID : storedRecord?.testVariantId;
  recordStateRef.writtenScore = storedWrittenRecord?.score;
  recordStateRef.skills = storedRecord ? storedRecord.skills.map(skillScore => ({ ...skillScore })) : [];
  recordStateRef.specialSkillList = storedRecord ? storedRecord.specialSkillList.map(specialSkill => ({ ...specialSkill })) : [];
}

watch(studentIdRef, loadRecord);
watch(() => props.session.id, () => {
  studentIdRef.value = undefined;
  loadRecord(undefined);
});

async function persistRecord() {
  const studentId = studentIdRef.value;
  const testVariantId = recordStateRef.testVariantId;
  if (!studentId || !testVariantId || props.readonly) return;

  try {
    if (testVariantId === WRITTEN_TEST_ID) {
      await saveSessionWrittenTestRecord(props.session.id, { studentId, score: recordStateRef.writtenScore });
      return;
    }

    // Scores for skills the test no longer has (it may have been re-imported with different skills) are dropped.
    const testSkillIdSet = new Set(selectedTestVariantRef.value?.skills.map(skill => skill.id));
    const specialSkillCount = selectedTestVariantRef.value?.specialSkillCount ?? 0;
    await saveSessionTestRecord(props.session.id, {
      studentId,
      testVariantId,
      skills: recordStateRef.skills.filter(skillScore => testSkillIdSet.has(skillScore.skillId)).map(skillScore => ({ ...skillScore })),
      specialSkillList: recordStateRef.specialSkillList.slice(0, specialSkillCount).map(specialSkill => ({ ...specialSkill }))
    });
  } catch (saveError) {
    showSaveError("Couldn't save test", saveError);
  }
}

// Progress is the number of the test's skills that have a score, the special skills included; the open student's
// edits take precedence over what is stored so the bar updates as scores change.
const progressByStudentIdRef = computed(() => {
  const progressByStudentId: Record<string, { done: number, total: number }> = {};

  for (const writtenRecord of props.session.writtenTests) {
    const isOpenStudent = writtenRecord.studentId === studentIdRef.value && isWrittenTestRef.value;
    const score = isOpenStudent ? recordStateRef.writtenScore : writtenRecord.score;
    progressByStudentId[writtenRecord.studentId] = { done: score === undefined ? 0 : 1, total: 1 };
  }

  for (const testRecord of props.session.tests) {
    const isOpenStudent = testRecord.studentId === studentIdRef.value;
    const testVariantId = isOpenStudent ? recordStateRef.testVariantId : testRecord.testVariantId;
    const skillList = isOpenStudent ? recordStateRef.skills : testRecord.skills;
    const specialSkillList = isOpenStudent ? recordStateRef.specialSkillList : testRecord.specialSkillList;
    const testVariant = sessionTestVariantListRef.value?.find(variantItem => variantItem.id === testVariantId);
    if (!testVariant) continue;

    const scoredSkillIdSet = new Set(skillList.map(skillScore => skillScore.skillId));
    const scoredSpecialSkillCount = specialSkillList.slice(0, testVariant.specialSkillCount).filter(specialSkill => specialSkill.score !== undefined).length;
    progressByStudentId[testRecord.studentId] = {
      done: testVariant.skills.filter(skill => scoredSkillIdSet.has(skill.id)).length + scoredSpecialSkillCount,
      total: testVariant.skills.length + testVariant.specialSkillCount
    };
  }
  return progressByStudentId;
});
//endregion

//region Test Selection
const testItemListRef = computed<SelectItem[]>(() => {
  const skillTestItemList: SelectItem[] = (sessionTestVariantListRef.value ?? []).map(testVariant => ({ label: testVariant.name, value: testVariant.id }));
  const writtenTestItem: SelectItem = { label: WRITTEN_TEST_NAME, value: WRITTEN_TEST_ID };
  // The Written Test is a different kind of test, so it sits apart from the others.
  return skillTestItemList.length > 0 ? [...skillTestItemList, { type: "separator" }, writtenTestItem] : [writtenTestItem];
});

const selectedTestVariantRef = computed(() =>
  sessionTestVariantListRef.value?.find(testVariant => testVariant.id === recordStateRef.testVariantId));

const hasEnteredScoresRef = computed(() =>
  recordStateRef.skills.length > 0
  || recordStateRef.writtenScore !== undefined
  || recordStateRef.specialSkillList.some(specialSkill => !!specialSkill.name || !!specialSkill.criteria || specialSkill.score !== undefined));

const isChangeConfirmOpenRef = ref(false);
const pendingTestVariantIdRef = ref<string>();

function applyTestVariant(testVariantId: string) {
  recordStateRef.testVariantId = testVariantId;
  recordStateRef.skills = [];
  recordStateRef.specialSkillList = [];
  recordStateRef.writtenScore = undefined;
  persistRecord();
}

// The select is driven by the stored value, so a cancelled change leaves it showing the current test.
function handleTestChange(testVariantId: string | undefined) {
  if (!testVariantId || testVariantId === recordStateRef.testVariantId) return;

  if (hasEnteredScoresRef.value) {
    pendingTestVariantIdRef.value = testVariantId;
    isChangeConfirmOpenRef.value = true;
    return;
  }
  applyTestVariant(testVariantId);
}

function handleConfirmChange() {
  const testVariantId = pendingTestVariantIdRef.value;
  pendingTestVariantIdRef.value = undefined;
  isChangeConfirmOpenRef.value = false;
  if (testVariantId) applyTestVariant(testVariantId);
}

function handleCancelChange() {
  pendingTestVariantIdRef.value = undefined;
  isChangeConfirmOpenRef.value = false;
}
//endregion

//region Scores
function getSkillScore(skillId: string) {
  return recordStateRef.skills.find(skillScore => skillScore.skillId === skillId)?.score;
}

// Skills without a score are left out of the list entirely.
function setSkillScore(skillId: string, score: number | undefined) {
  const otherSkillList = recordStateRef.skills.filter(skillScore => skillScore.skillId !== skillId);
  recordStateRef.skills = score === undefined ? otherSkillList : [...otherSkillList, { skillId, score }];
  persistRecord();
}

// The special skill whose name and criteria are being edited, by its position in the test's special skills.
const editingSpecialSkillIndexRef = ref<number>();
const isSpecialSkillModalOpenRef = computed({
  get: () => editingSpecialSkillIndexRef.value !== undefined,
  set: (isOpen) => {
    if (!isOpen) editingSpecialSkillIndexRef.value = undefined;
  }
});

const specialSkillCountRef = computed(() => selectedTestVariantRef.value?.specialSkillCount ?? 0);

const specialSkillPointsRef = computed(() =>
  recordStateRef.specialSkillList.slice(0, specialSkillCountRef.value).reduce((scoreSum, specialSkill) => scoreSum + (specialSkill.score ?? 0), 0));

function getSpecialSkill(index: number): SpecialSkill {
  return recordStateRef.specialSkillList[index] ?? createEmptySpecialSkill();
}

function getSpecialSkillLabel(index: number) {
  return getSpecialSkill(index).name || (specialSkillCountRef.value > 1 ? `Special skill ${index + 1}` : "Special skill");
}

// Entries are only created once something is filled in, so earlier ones are padded with empty skills.
function setSpecialSkillField<Field extends keyof SpecialSkill>(index: number, field: Field, value: SpecialSkill[Field]) {
  const specialSkillList = [...recordStateRef.specialSkillList];
  while (specialSkillList.length <= index) specialSkillList.push(createEmptySpecialSkill());
  specialSkillList[index] = { ...specialSkillList[index]!, [field]: value };
  recordStateRef.specialSkillList = specialSkillList;
  persistRecord();
}

function setWrittenScore(score: number | undefined) {
  recordStateRef.writtenScore = score;
  persistRecord();
}

const scoreBySkillIdRef = computed(() => new Map(recordStateRef.skills.map(skillScore => [skillScore.skillId, skillScore.score])));

// Skills grouped under their category, in the enum's order, with the points earned and available per group.
const skillGroupListRef = computed(() => {
  const skillList = selectedTestVariantRef.value?.skills ?? [];
  return Object.values(TestSkillCategoryEnum)
    .map((category) => {
      const groupSkillList = skillList.filter(skill => skill.category === category);
      return {
        category,
        label: `${category} Evaluation`,
        skillList: groupSkillList,
        earnedScore: groupSkillList.reduce((scoreSum, skill) => scoreSum + (scoreBySkillIdRef.value.get(skill.id) ?? 0), 0),
        maxScore: groupSkillList.reduce((maxSum, skill) => maxSum + skill.maxScore, 0)
      };
    })
    .filter(skillGroup => skillGroup.skillList.length > 0);
});

// Each special skill counts as one more skill worth SPECIAL_SKILL_MAX_SCORE points.
const scoreSummaryRef = computed(() => {
  const skillList = selectedTestVariantRef.value?.skills ?? [];
  const scoreBySkillId = scoreBySkillIdRef.value;
  const specialScoreList = recordStateRef.specialSkillList.slice(0, specialSkillCountRef.value).flatMap(specialSkill => (specialSkill.score === undefined ? [] : [specialSkill.score]));

  const totalScore = skillList.reduce((scoreSum, skill) => scoreSum + (scoreBySkillId.get(skill.id) ?? 0), 0) + specialScoreList.reduce((scoreSum, score) => scoreSum + score, 0);
  const maxTotalScore = skillList.reduce((maxSum, skill) => maxSum + skill.maxScore, 0) + specialSkillCountRef.value * SPECIAL_SKILL_MAX_SCORE;

  return {
    filledCount: skillList.filter(skill => scoreBySkillId.has(skill.id)).length + specialScoreList.length,
    totalCount: skillList.length + specialSkillCountRef.value,
    totalScore,
    maxTotalScore,
    percentText: `${maxTotalScore === 0 ? 0 : Math.round(totalScore / maxTotalScore * 100)}%`
  };
});
//endregion

//region Written Test Description
// Shared by every student, so it is saved on the session rather than on a student's record.
const writtenDescriptionRef = ref(props.session.writtenTestDescription ?? "");
watch(() => props.session.id, () => {
  writtenDescriptionRef.value = props.session.writtenTestDescription ?? "";
});

async function setWrittenDescription(description: string) {
  writtenDescriptionRef.value = description;
  if (props.readonly) return;
  try {
    await saveSessionEdit(props.session.id, { writtenTestDescription: description });
  } catch (saveError) {
    showSaveError("Couldn't save description", saveError);
  }
}
//endregion
</script>

<template>
  <div class="space-y-4 px-3 sm:px-4">
    <div class="grid gap-4 md:grid-cols-2">
      <UFormField
        label="Student"
        required
      >
        <StudentSelect
          v-model="studentIdRef"
          :student-list="attendingStudentListRef"
          :progress-by-student-id="progressByStudentIdRef"
        />
      </UFormField>

      <UFormField
        label="Test"
        required
      >
        <USelect
          :model-value="recordStateRef.testVariantId"
          :items="testItemListRef"
          placeholder="Select test"
          :disabled="readonly || !studentIdRef"
          class="w-full"
          @update:model-value="handleTestChange"
        />
      </UFormField>
    </div>

    <p
      v-if="(sessionTestVariantListRef ?? []).length === 0"
      class="text-sm text-muted"
    >
      No skill tests available yet. Import your tests to score them; the Written Test is always available.
    </p>

    <SessionWrittenTest
      v-if="isWrittenTestRef"
      :description="writtenDescriptionRef"
      :score="recordStateRef.writtenScore"
      :disabled="readonly"
      @update:description="setWrittenDescription"
      @update:score="setWrittenScore"
    />

    <div
      v-else-if="selectedTestVariantRef"
      class="overflow-hidden rounded-md border border-muted"
    >
      <template
        v-for="skillGroup in skillGroupListRef"
        :key="skillGroup.category"
      >
        <div class="flex items-center justify-between gap-3 border-t border-muted bg-elevated/50 px-4 py-2 first:border-t-0">
          <h3 class="text-sm font-semibold">
            {{ skillGroup.label }}
          </h3>
          <span class="text-sm text-muted">
            {{ skillGroup.earnedScore }}/{{ skillGroup.maxScore }} pts
          </span>
        </div>
        <InputNumberScrub
          v-for="skill in skillGroup.skillList"
          :key="skill.id"
          :model-value="getSkillScore(skill.id)"
          :label="skill.name"
          :description="skill.criteria"
          show-max
          :min="0"
          :max="skill.maxScore"
          :disabled="readonly"
          size="sm"
          class="border-t border-muted"
          @update:model-value="setSkillScore(skill.id, $event)"
        />
      </template>

      <template v-if="specialSkillCountRef > 0">
        <div class="flex items-center justify-between gap-3 border-t border-muted bg-elevated/50 px-4 py-2">
          <h3 class="text-sm font-semibold">
            Special Skills
          </h3>
          <span class="text-sm text-muted">
            {{ specialSkillPointsRef }}/{{ specialSkillCountRef * SPECIAL_SKILL_MAX_SCORE }} pts
          </span>
        </div>
        <div
          v-for="specialSkillIndex in specialSkillCountRef"
          :key="specialSkillIndex"
          class="flex items-center border-t border-muted pl-2"
        >
          <UButton
            icon="i-lucide-pencil"
            color="neutral"
            variant="ghost"
            size="sm"
            :aria-label="`Edit ${getSpecialSkillLabel(specialSkillIndex - 1)}`"
            :disabled="readonly"
            @click="editingSpecialSkillIndexRef = specialSkillIndex - 1"
          />
          <InputNumberScrub
            :model-value="getSpecialSkill(specialSkillIndex - 1).score"
            :label="getSpecialSkillLabel(specialSkillIndex - 1)"
            :description="getSpecialSkill(specialSkillIndex - 1).criteria"
            show-max
            :min="0"
            :max="SPECIAL_SKILL_MAX_SCORE"
            :disabled="readonly"
            size="sm"
            class="min-w-0 flex-1 pl-2"
            @update:model-value="setSpecialSkillField(specialSkillIndex - 1, 'score', $event)"
          />
        </div>
      </template>

      <div class="flex items-center justify-between gap-3 border-t border-muted bg-elevated/50 px-4 py-3">
        <span class="text-sm text-muted">
          {{ scoreSummaryRef.filledCount }}/{{ scoreSummaryRef.totalCount }} scored
        </span>
        <div class="text-right">
          <p class="text-lg font-semibold leading-tight">
            {{ scoreSummaryRef.totalScore }}/{{ scoreSummaryRef.maxTotalScore }}
          </p>
          <p class="text-xs text-muted">
            {{ scoreSummaryRef.percentText }}
          </p>
        </div>
      </div>
    </div>

    <UEmpty
      v-else
      variant="naked"
      :icon="studentIdRef ? 'i-lucide-clipboard-list' : 'i-lucide-user-round-search'"
      :title="studentIdRef ? 'No test selected' : 'No student selected'"
      :description="studentIdRef ? 'Choose a test above to start entering scores.' : 'Choose a student above, then pick a test to score.'"
      class="py-10"
    />

    <!-- Every change is saved as it is typed, so there are no confirm or cancel buttons. -->
    <UModal
      v-model:open="isSpecialSkillModalOpenRef"
      title="Special skill"
    >
      <template #body>
        <div
          v-if="editingSpecialSkillIndexRef !== undefined"
          class="space-y-3"
        >
          <UInput
            :model-value="getSpecialSkill(editingSpecialSkillIndexRef).name"
            placeholder="Skill name"
            aria-label="Special skill name"
            :maxlength="50"
            class="w-full"
            @update:model-value="setSpecialSkillField(editingSpecialSkillIndexRef, 'name', $event)"
          />
          <UTextarea
            :model-value="getSpecialSkill(editingSpecialSkillIndexRef).criteria"
            placeholder="Criteria"
            aria-label="Special skill criteria"
            :maxlength="300"
            :rows="3"
            autoresize
            class="w-full"
            @update:model-value="setSpecialSkillField(editingSpecialSkillIndexRef, 'criteria', $event)"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="isChangeConfirmOpenRef"
      title="Change test?"
      description="Scores entered for this student will be lost."
      @update:open="open => !open && handleCancelChange()"
    >
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            type="button"
            label="Cancel"
            color="neutral"
            variant="outline"
            @click="handleCancelChange"
          />
          <UButton
            type="button"
            label="Change test"
            color="error"
            @click="handleConfirmChange"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
