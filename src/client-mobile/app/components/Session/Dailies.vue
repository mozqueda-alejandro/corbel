<script setup lang="ts">
import {
  DAILY_SKILL_SCORE_MAX,
  DAILY_SKILL_SCORE_MIN,
  type DailySkillScore,
  type Session,
  type SessionDailyRecord
} from "~/schemas/session.schema";

const TEXT_MAX_LENGTH = 200;
const SAVE_DELAY_MS = 400;

//region Props and Composables
// readonly is set for completed and archived sessions.
const props = defineProps<{
  session: Session
  readonly?: boolean
}>();

const toast = useToast();
const { attendingStudentListRef } = useAttendingStudentList(() => props.session);
const { activityTypeListRef } = useActivityTypeRepository();
const { dailySkillListRef } = useDailySkillRepository();
const { saveSessionDailyRecord } = useSessionRepository();
//endregion

//region Record
// Like Tests there is no Save button: every edit is written straight to the session. A student has one
// daily record per session; the activity is a field on it.
const studentIdRef = ref<string>();
const formStateRef = reactive<{ activity?: string, comments: string, recommendation: string, skills: DailySkillScore[] }>(
  { activity: undefined, comments: "", recommendation: "", skills: [] }
);

// A student without a record starts with the previous student's activity, since a class usually does one at a time.
function loadRecord(studentId: string | undefined) {
  const storedRecord = props.session.dailies.find(record => record.studentId === studentId);
  formStateRef.activity = storedRecord?.activity ?? formStateRef.activity;
  formStateRef.comments = storedRecord?.comments ?? "";
  formStateRef.recommendation = storedRecord?.recommendation ?? "";
  formStateRef.skills = storedRecord ? storedRecord.skills.map(skillScore => ({ ...skillScore })) : [];
}

watch(studentIdRef, (studentId) => {
  flushSave();
  loadRecord(studentId);
});
watch(() => props.session.id, () => {
  flushSave();
  studentIdRef.value = undefined;
  formStateRef.activity = undefined;
  loadRecord(undefined);
});
//endregion

//region Saving
// Typing is saved after a short pause. The pending record is captured when the edit happens, so switching
// student or session before the pause ends still writes it to the right place.
let pendingSave: { sessionId: string, record: SessionDailyRecord } | undefined;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function scheduleSave() {
  const studentId = studentIdRef.value;
  if (!studentId || props.readonly) return;

  pendingSave = {
    sessionId: props.session.id,
    record: {
      studentId,
      activity: formStateRef.activity,
      comments: formStateRef.comments.trim() || undefined,
      recommendation: formStateRef.recommendation.trim() || undefined,
      skills: formStateRef.skills.map(skillScore => ({ ...skillScore }))
    }
  };
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, SAVE_DELAY_MS);
}

async function flushSave() {
  clearTimeout(saveTimer);
  const save = pendingSave;
  pendingSave = undefined;
  if (!save) return;

  try {
    await saveSessionDailyRecord(save.sessionId, save.record);
  } catch (saveError) {
    console.error("Daily save failed:", saveError);
    toast.add({
      title: "Couldn't save daily",
      description: saveError instanceof Error ? saveError.message : undefined,
      color: "error",
      icon: "i-lucide-circle-x"
    });
  }
}

onBeforeUnmount(flushSave);
//endregion

//region Scores
function getSkillScore(skillId: string) {
  return formStateRef.skills.find(skillScore => skillScore.skillId === skillId)?.score;
}

// Skills without a score are left out of the list entirely.
function setSkillScore(skillId: string, score: number | undefined) {
  const otherSkillList = formStateRef.skills.filter(skillScore => skillScore.skillId !== skillId);
  formStateRef.skills = score === undefined ? otherSkillList : [...otherSkillList, { skillId, score }];
  scheduleSave();
}

// The percentage is the average score as a share of the maximum score.
const scoreSummaryRef = computed(() => {
  const dailySkillIdSet = new Set((dailySkillListRef.value ?? []).map(dailySkill => dailySkill.id));
  const scoreList = formStateRef.skills
    .filter(skillScore => dailySkillIdSet.has(skillScore.skillId))
    .map(skillScore => skillScore.score);
  const averageScore = scoreList.length > 0
    ? scoreList.reduce((scoreSum, score) => scoreSum + score, 0) / scoreList.length
    : undefined;

  return {
    filledCount: scoreList.length,
    totalCount: dailySkillIdSet.size,
    averageText: averageScore === undefined ? "–" : averageScore.toFixed(1),
    percentText: averageScore === undefined ? "–" : `${Math.round(averageScore / DAILY_SKILL_SCORE_MAX * 100)}%`
  };
});
//endregion

//region Progress
// A daily has an activity, a recommendation and one score per daily skill to fill in; it is completed once
// all of them are, and a student with no record hasn't started. Comments are optional.
function getDailyProgress(record: Pick<SessionDailyRecord, "activity" | "recommendation" | "skills">) {
  const skillIdList = (dailySkillListRef.value ?? []).map(dailySkill => dailySkill.id);
  const scoredSkillIdSet = new Set(record.skills.map(skillScore => skillScore.skillId));
  const filledFieldList = [record.activity, record.recommendation];
  return {
    done: filledFieldList.filter(Boolean).length + skillIdList.filter(skillId => scoredSkillIdSet.has(skillId)).length,
    total: filledFieldList.length + skillIdList.length
  };
}

const progressByStudentIdRef = computed(() => {
  const progressByStudentId: Record<string, { done: number, total: number }> = {};
  for (const record of props.session.dailies) {
    // The open student's form takes precedence so the bar updates as they type, before the save lands.
    const isOpenStudent = record.studentId === studentIdRef.value;
    progressByStudentId[record.studentId] = getDailyProgress(isOpenStudent
      ? { ...formStateRef, recommendation: formStateRef.recommendation.trim() }
      : record);
  }
  return progressByStudentId;
});

// The last row opens the add dialog instead of picking a value, so its value is one no activity name can have.
const ADD_ACTIVITY_VALUE = "\0add-activity";

const activityItemListRef = computed(() => [
  ...(activityTypeListRef.value ?? [])
    .map(activityType => activityType.name)
    .sort((nameA, nameB) => nameA.localeCompare(nameB)),
  { type: "separator" as const },
  { label: "Add Activity", value: ADD_ACTIVITY_VALUE, icon: "i-lucide-plus" }
]);

const isActivityModalOpenRef = ref(false);

function handleActivitySelected(activity: string | undefined) {
  if (activity === ADD_ACTIVITY_VALUE) {
    isActivityModalOpenRef.value = true;
    return;
  }
  formStateRef.activity = activity;
  scheduleSave();
}

// Assigns the new activity to the daily that was being edited.
function handleActivityCreated(activity: string) {
  formStateRef.activity = activity;
  scheduleSave();
}
//endregion
</script>

<template>
  <div class="space-y-4 px-3 sm:px-4">
    <div class="grid gap-4 md:grid-cols-2">
      <div class="flex flex-col gap-3">
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
        <UFormField label="Activity">
          <USelect
            :model-value="formStateRef.activity"
            :items="activityItemListRef"
            placeholder="Select activity"
            icon="i-lucide-hammer"
            :disabled="readonly || !studentIdRef"
            class="w-full"
            @update:model-value="handleActivitySelected"
          />
        </UFormField>
        <UFormField
          label="Comments"
          :hint="`${formStateRef.comments.length}/${TEXT_MAX_LENGTH}`"
        >
          <UTextarea
            v-model="formStateRef.comments"
            :rows="6"
            :maxlength="TEXT_MAX_LENGTH"
            :disabled="readonly || !studentIdRef"
            class="w-full"
            @update:model-value="scheduleSave"
          />
        </UFormField>
        <UFormField
          label="Recommendations"
          :hint="`${formStateRef.recommendation.length}/${TEXT_MAX_LENGTH}`"
        >
          <UTextarea
            v-model="formStateRef.recommendation"
            :rows="6"
            :maxlength="TEXT_MAX_LENGTH"
            :disabled="readonly || !studentIdRef"
            class="w-full"
            @update:model-value="scheduleSave"
          />
        </UFormField>
        <StudentPhotoStrip
          :session="session"
          :student-id="studentIdRef"
          :readonly="readonly"
        />
      </div>

      <UFormField label="Skills">
        <div class="overflow-hidden rounded-md border border-muted">
          <p
            v-if="(dailySkillListRef ?? []).length === 0"
            class="px-4 py-6 text-center text-sm text-muted"
          >
            No daily skills yet.
          </p>
          <InputNumberScrub
            v-for="dailySkill in dailySkillListRef"
            :key="dailySkill.id"
            :model-value="getSkillScore(dailySkill.id)"
            :label="dailySkill.name"
            :min="DAILY_SKILL_SCORE_MIN"
            :max="DAILY_SKILL_SCORE_MAX"
            :disabled="readonly || !studentIdRef"
            size="sm"
            class="border-t border-muted first:border-t-0"
            @update:model-value="setSkillScore(dailySkill.id, $event)"
          />
          <div
            v-if="scoreSummaryRef.totalCount > 0"
            class="flex items-center justify-between gap-3 border-t border-muted bg-elevated/50 px-4 py-3"
          >
            <span class="text-sm text-muted">
              {{ scoreSummaryRef.filledCount }}/{{ scoreSummaryRef.totalCount }} scored
            </span>
            <div class="text-right">
              <p class="text-lg font-semibold leading-tight">
                {{ scoreSummaryRef.averageText }}
              </p>
              <p class="text-xs text-muted">
                {{ scoreSummaryRef.percentText }}
              </p>
            </div>
          </div>
        </div>
      </UFormField>
    </div>

    <ActivityCreateModal
      v-model:open="isActivityModalOpenRef"
      @created="handleActivityCreated"
    />
  </div>
</template>
