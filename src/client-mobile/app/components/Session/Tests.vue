<script setup lang="ts">
import type { Session, TestSkillScore } from "~/schemas/session.schema";
import { TestSkillCategoryEnum } from "~/schemas/test-skill.schema";

//region Props and Composables
// readonly is set for completed and archived sessions.
const props = defineProps<{
  session: Session
  readonly?: boolean
}>();

const toast = useToast();
const { attendingStudentListRef } = useAttendingStudentList(() => props.session);
const { sessionTestVariantListRef } = useSessionTestVariantList(() => props.session);
const { saveSessionTestRecord } = useSessionRepository();
//endregion

//region Record
// Unlike Dailies there is no Save button: every edit is written straight to the session.
const studentIdRef = ref<string>();
const recordStateRef = reactive<{ testVariantId?: string, skills: TestSkillScore[] }>({ testVariantId: undefined, skills: [] });

function loadRecord(studentId: string | undefined) {
  const storedRecord = props.session.tests.find(testRecord => testRecord.studentId === studentId);
  recordStateRef.testVariantId = storedRecord?.testVariantId;
  recordStateRef.skills = storedRecord ? storedRecord.skills.map(skillScore => ({ ...skillScore })) : [];
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

  // Scores for skills the test no longer has (it may have been re-imported with different skills) are dropped.
  const testSkillIdSet = new Set(selectedTestVariantRef.value?.skills.map(skill => skill.id));

  try {
    await saveSessionTestRecord(props.session.id, {
      studentId,
      testVariantId,
      skills: recordStateRef.skills.filter(skillScore => testSkillIdSet.has(skillScore.skillId)).map(skillScore => ({ ...skillScore }))
    });
  } catch (saveError) {
    console.error("Test save failed:", saveError);
    toast.add({
      title: "Couldn't save test",
      description: saveError instanceof Error ? saveError.message : undefined,
      color: "error",
      icon: "i-lucide-circle-x"
    });
  }
}

// Progress is the number of the test's skills that have a score; the open student's unsaved-in-props edits
// take precedence so the bar updates as scores change.
const progressByStudentIdRef = computed(() => {
  const progressByStudentId: Record<string, { done: number, total: number }> = {};
  for (const testRecord of props.session.tests) {
    const isOpenStudent = testRecord.studentId === studentIdRef.value;
    const testVariantId = isOpenStudent ? recordStateRef.testVariantId : testRecord.testVariantId;
    const skillList = isOpenStudent ? recordStateRef.skills : testRecord.skills;
    const testVariant = sessionTestVariantListRef.value?.find(variantItem => variantItem.id === testVariantId);
    if (!testVariant) continue;

    const scoredSkillIdSet = new Set(skillList.map(skillScore => skillScore.skillId));
    progressByStudentId[testRecord.studentId] = {
      done: testVariant.skills.filter(skill => scoredSkillIdSet.has(skill.id)).length,
      total: testVariant.skills.length
    };
  }
  return progressByStudentId;
});
//endregion

//region Test Selection
const testItemListRef = computed(() =>
  (sessionTestVariantListRef.value ?? []).map(testVariant => ({ label: testVariant.name, value: testVariant.id })));

const selectedTestVariantRef = computed(() =>
  sessionTestVariantListRef.value?.find(testVariant => testVariant.id === recordStateRef.testVariantId));

const isChangeConfirmOpenRef = ref(false);
const pendingTestVariantIdRef = ref<string>();

function applyTestVariant(testVariantId: string) {
  recordStateRef.testVariantId = testVariantId;
  recordStateRef.skills = [];
  persistRecord();
}

// The select is driven by the stored value, so a cancelled change leaves it showing the current test.
function handleTestChange(testVariantId: string | undefined) {
  if (!testVariantId || testVariantId === recordStateRef.testVariantId) return;

  if (recordStateRef.skills.length > 0) {
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

const scoreSummaryRef = computed(() => {
  const skillList = selectedTestVariantRef.value?.skills ?? [];
  const scoreBySkillId = scoreBySkillIdRef.value;

  const totalScore = skillList.reduce((scoreSum, skill) => scoreSum + (scoreBySkillId.get(skill.id) ?? 0), 0);
  const maxTotalScore = skillList.reduce((maxSum, skill) => maxSum + skill.maxScore, 0);

  return {
    filledCount: skillList.filter(skill => scoreBySkillId.has(skill.id)).length,
    totalCount: skillList.length,
    totalScore,
    maxTotalScore,
    percentText: maxTotalScore > 0 ? `${Math.round(totalScore / maxTotalScore * 100)}%` : "–"
  };
});
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
          icon="i-lucide-clipboard-list"
          :disabled="readonly || !studentIdRef || testItemListRef.length === 0"
          class="w-full"
          @update:model-value="handleTestChange"
        />
      </UFormField>
    </div>

    <p
      v-if="testItemListRef.length === 0"
      class="text-sm text-muted"
    >
      No tests available yet. Import your tests to start entering scores.
    </p>

    <div
      v-if="selectedTestVariantRef"
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
      v-else-if="testItemListRef.length > 0"
      variant="naked"
      :icon="studentIdRef ? 'i-lucide-clipboard-list' : 'i-lucide-user-round-search'"
      :title="studentIdRef ? 'No test selected' : 'No student selected'"
      :description="studentIdRef ? 'Choose a test above to start entering scores.' : 'Choose a student above, then pick a test to score.'"
      class="py-10"
    />

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
