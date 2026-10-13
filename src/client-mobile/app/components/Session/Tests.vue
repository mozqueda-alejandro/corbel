<script setup lang="ts">
import type { Session, TestSkillScore } from "~/schemas/session.schema";

//region Props and Composables
// readonly is set for completed and archived sessions.
const props = defineProps<{
  session: Session
  readonly?: boolean
}>();

const toast = useToast();
const { attendingStudentListRef } = useAttendingStudentList(() => props.session);
const { testVariantListRef } = useTestVariantRepository();
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

  try {
    await saveSessionTestRecord(props.session.id, {
      studentId,
      testVariantId,
      skills: recordStateRef.skills.map(skillScore => ({ ...skillScore }))
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

// A test is completed once every one of its skills has a score; removing any score puts it back in progress.
const studentGroupList = [
  { progress: undefined, label: "In progress" },
  { progress: "completed", label: "Completed" }
];

const progressByStudentIdRef = computed(() => {
  const progressByStudentId: Record<string, string> = {};
  for (const testRecord of props.session.tests) {
    // The open student's unsaved-in-props edits take precedence so the group updates as scores change.
    const isOpenStudent = testRecord.studentId === studentIdRef.value;
    const testVariantId = isOpenStudent ? recordStateRef.testVariantId : testRecord.testVariantId;
    const skillList = isOpenStudent ? recordStateRef.skills : testRecord.skills;
    const testVariant = testVariantListRef.value?.find(variantItem => variantItem.id === testVariantId);
    if (!testVariant) continue;

    const scoredSkillIdSet = new Set(skillList.map(skillScore => skillScore.skillId));
    if (testVariant.skills.every(skill => scoredSkillIdSet.has(skill.id))) progressByStudentId[testRecord.studentId] = "completed";
  }
  return progressByStudentId;
});
//endregion

//region Test Selection
const testItemListRef = computed(() =>
  (testVariantListRef.value ?? []).map(testVariant => ({ label: testVariant.name, value: testVariant.id })));

const selectedTestVariantRef = computed(() =>
  testVariantListRef.value?.find(testVariant => testVariant.id === recordStateRef.testVariantId));

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

const scoreSummaryRef = computed(() => {
  const skillList = selectedTestVariantRef.value?.skills ?? [];
  const scoreBySkillId = new Map(recordStateRef.skills.map(skillScore => [skillScore.skillId, skillScore.score]));

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
          :group-list="studentGroupList"
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
      <InputNumberScrub
        v-for="skill in selectedTestVariantRef.skills"
        :key="skill.id"
        :model-value="getSkillScore(skill.id)"
        :label="skill.name"
        :description="skill.criteria"
        show-max
        :min="0"
        :max="skill.maxScore"
        :disabled="readonly"
        size="sm"
        class="border-t border-muted first:border-t-0"
        @update:model-value="setSkillScore(skill.id, $event)"
      />
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
