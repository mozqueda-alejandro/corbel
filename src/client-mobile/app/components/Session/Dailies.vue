<script setup lang="ts">
import type { FormSubmitEvent } from "@nuxt/ui";
import { useEventListener } from "@vueuse/core";

import {
  DAILY_SKILL_SCORE_MAX,
  DAILY_SKILL_SCORE_MIN,
  type DailySkillScore,
  type Session,
  type SessionDailyForm,
  sessionDailyFormSchema,
  type SessionDailyRecord
} from "~/schemas/session.schema";

//region Types and Constants
type DailyFormState = {
  studentId?: string
  activityId?: string
  comments: string
  recommendation: string
  skills: DailySkillScore[]
};

const TEXT_MAX_LENGTH = 200;
//endregion

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
const { saveSessionEdit } = useSessionRepository();
//endregion

//region Form
const formRef = useTemplateRef("formRef");
const formStateRef = reactive<DailyFormState>(createBlankFormState());

function createBlankFormState(): DailyFormState {
  return { studentId: undefined, activityId: undefined, comments: "", recommendation: "", skills: [] };
}

function resetForm() {
  Object.assign(formStateRef, createBlankFormState());
  formRef.value?.clear();
}

function getSkillScore(skillId: string) {
  return formStateRef.skills.find(skillScore => skillScore.skillId === skillId)?.score;
}

// Skills without a score are left out of the list entirely.
function setSkillScore(skillId: string, score: number | undefined) {
  const otherSkillList = formStateRef.skills.filter(skillScore => skillScore.skillId !== skillId);
  formStateRef.skills = score === undefined ? otherSkillList : [...otherSkillList, { skillId, score }];
}

// A student has one daily record per session; the activity is a field on it.
function findDailyRecord(studentId: string | undefined) {
  return props.session.dailies.find(record => record.studentId === studentId);
}

watch(() => props.session.id, resetForm);
//endregion

//region Unsaved Changes Guard
type ContentFields = { activityId?: string, comments?: string, recommendation?: string, skills: DailySkillScore[] };

type GuardedAction = { proceed: () => void, cancel?: () => void };

const isUnsavedConfirmOpenRef = ref(false);
let pendingGuardedAction: GuardedAction | undefined;
let afterSaveAction: GuardedAction | undefined;

function getContentKey(content: ContentFields) {
  return JSON.stringify({
    activityId: content.activityId,
    comments: (content.comments ?? "").trim(),
    recommendation: (content.recommendation ?? "").trim(),
    skills: content.skills.map(({ skillId, score }) => [skillId, score]).sort()
  });
}

// Unsaved means the form differs from the student's stored record. Without a record the baseline is
// blank content with the current activity, since the activity alone carries over between students.
function hasUnsavedChanges() {
  if (!formStateRef.studentId) return false;
  const savedRecord = findDailyRecord(formStateRef.studentId);
  return getContentKey(formStateRef)
    !== getContentKey(savedRecord ?? { ...createBlankFormState(), activityId: formStateRef.activityId });
}

// cancel runs when the user backs out of the dialog or the save fails.
function runUnlessUnsaved(proceed: () => void, cancel?: () => void) {
  if (!hasUnsavedChanges()) {
    proceed();
    return;
  }
  pendingGuardedAction = { proceed, cancel };
  isUnsavedConfirmOpenRef.value = true;
}

function handleStudentChange(studentId: string | undefined) {
  if (studentId === formStateRef.studentId) return;
  runUnlessUnsaved(() => {
    // Content typed before any student was picked is kept for the newly picked student.
    if (formStateRef.studentId) Object.assign(formStateRef, { comments: "", recommendation: "", skills: [] });
    formStateRef.studentId = studentId;

    const savedRecord = findDailyRecord(studentId);
    if (!savedRecord) return;
    Object.assign(formStateRef, {
      activityId: savedRecord.activityId,
      comments: savedRecord.comments ?? "",
      recommendation: savedRecord.recommendation ?? "",
      skills: savedRecord.skills.map(skillScore => ({ ...skillScore }))
    });
  });
}

function handleDiscardChanges() {
  const guardedAction = pendingGuardedAction;
  pendingGuardedAction = undefined;
  isUnsavedConfirmOpenRef.value = false;
  guardedAction?.proceed();
}

// The guarded action only runs if the form validates and saves.
async function handleSaveChanges() {
  afterSaveAction = pendingGuardedAction;
  pendingGuardedAction = undefined;
  isUnsavedConfirmOpenRef.value = false;
  pendingActionRef.value = "save";
  await formRef.value?.submit();
}

// Closing the dialog without choosing cancels the guarded action.
watch(isUnsavedConfirmOpenRef, (isOpen) => {
  if (isOpen) return;
  pendingGuardedAction?.cancel?.();
  pendingGuardedAction = undefined;
});

function handleFormError() {
  afterSaveAction?.cancel?.();
  afterSaveAction = undefined;
}

//region Leaving the Page
function confirmLeave() {
  return new Promise<boolean>(resolve => runUnlessUnsaved(() => resolve(true), () => resolve(false)));
}

// Switching to another session reuses this component, so it is guarded like leaving the route.
onBeforeRouteLeave(confirmLeave);
onBeforeRouteUpdate((to, from) => (to.params.id === from.params.id ? true : confirmLeave()));

// Reload and tab close only allow the browser's own prompt.
useEventListener(window, "beforeunload", (unloadEvent) => {
  if (hasUnsavedChanges()) unloadEvent.preventDefault();
});
//endregion
//endregion

//region Dropdown Data
const progressByStudentIdRef = computed(() => {
  const progressByStudentId: Record<string, "saved" | "submitted"> = {};
  for (const record of props.session.dailies) {
    progressByStudentId[record.studentId] = record.submittedAt ? "submitted" : "saved";
  }
  return progressByStudentId;
});

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

const activityItemListRef = computed(() =>
  (activityTypeListRef.value ?? []).map(activityType => ({ label: activityType.name, value: activityType.id })));
//endregion

//region Saving and Submitting
const pendingActionRef = ref<"save" | "submit">("save");
const isBlankConfirmOpenRef = ref(false);
const blankFieldLabelListRef = ref<string[]>([]);
const pendingSubmitDataRef = ref<SessionDailyForm>();

async function persistDailyRecord(formData: SessionDailyForm, shouldSubmit: boolean) {
  const existingRecord = findDailyRecord(formData.studentId);
  const dailyRecord: SessionDailyRecord = {
    studentId: formData.studentId,
    activityId: formData.activityId,
    comments: formData.comments || undefined,
    recommendation: formData.recommendation || undefined,
    skills: formData.skills,
    submittedAt: shouldSubmit ? new Date() : existingRecord?.submittedAt
  };
  const dailyList = [...props.session.dailies.filter(record => record.studentId !== formData.studentId), dailyRecord];

  try {
    await saveSessionEdit(props.session.id, { dailies: dailyList });
  } catch (saveError) {
    console.error("Daily save failed:", saveError);
    toast.add({
      title: "Couldn't save daily",
      description: saveError instanceof Error ? saveError.message : undefined,
      color: "error",
      icon: "i-lucide-circle-x"
    });
    return false;
  }

  toast.add({ title: shouldSubmit ? "Daily submitted" : "Daily saved", color: "success", icon: "i-lucide-circle-check" });
  if (shouldSubmit) resetForm();
  return true;
}

function getBlankFieldLabelList(formData: SessionDailyForm) {
  const scoredSkillIdSet = new Set(formData.skills.map(skillScore => skillScore.skillId));
  const blankFieldLabelList = (dailySkillListRef.value ?? [])
    .filter(dailySkill => !scoredSkillIdSet.has(dailySkill.id))
    .map(dailySkill => dailySkill.name);
  if (!formData.comments) blankFieldLabelList.push("Comments");
  if (!formData.recommendation) blankFieldLabelList.push("Recommendation");
  return blankFieldLabelList;
}

// Only runs once the schema accepts the form, so a missing student or activity never gets this far.
async function handleFormSubmit(submitEvent: FormSubmitEvent<SessionDailyForm>) {
  if (props.readonly) return;

  const followUpAction = afterSaveAction;
  afterSaveAction = undefined;

  if (pendingActionRef.value === "save") {
    if (await persistDailyRecord(submitEvent.data, false)) followUpAction?.proceed();
    else followUpAction?.cancel?.();
    return;
  }

  const blankFieldLabelList = getBlankFieldLabelList(submitEvent.data);
  if (blankFieldLabelList.length > 0) {
    blankFieldLabelListRef.value = blankFieldLabelList;
    pendingSubmitDataRef.value = submitEvent.data;
    isBlankConfirmOpenRef.value = true;
    return;
  }
  await persistDailyRecord(submitEvent.data, true);
}

async function handleConfirmBlankSubmit() {
  isBlankConfirmOpenRef.value = false;
  if (pendingSubmitDataRef.value) await persistDailyRecord(pendingSubmitDataRef.value, true);
}
//endregion
</script>

<template>
  <UForm
    ref="formRef"
    :schema="sessionDailyFormSchema"
    :state="formStateRef"
    :validate-on="['input', 'change']"
    class="space-y-4 px-3 sm:px-4"
    @submit="handleFormSubmit"
    @error="handleFormError"
  >
    <div class="grid gap-4 md:grid-cols-2">
      <div class="flex flex-col gap-3">
        <UFormField
          label="Student"
          name="studentId"
          required
        >
          <StudentSelect
            :model-value="formStateRef.studentId"
            :student-list="attendingStudentListRef"
            :progress-by-student-id="progressByStudentIdRef"
            :disabled="readonly"
            @update:model-value="handleStudentChange"
          />
        </UFormField>
        <UFormField
          label="Activity"
          name="activityId"
          required
        >
          <USelect
            v-model="formStateRef.activityId"
            :items="activityItemListRef"
            placeholder="Select activity"
            icon="i-lucide-hammer"
            :disabled="readonly"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Comments"
          name="comments"
          :hint="`${formStateRef.comments.length}/${TEXT_MAX_LENGTH}`"
        >
          <UTextarea
            v-model="formStateRef.comments"
            :rows="6"
            :maxlength="TEXT_MAX_LENGTH"
            :disabled="readonly"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Recommendations"
          name="recommendation"
          :hint="`${formStateRef.recommendation.length}/${TEXT_MAX_LENGTH}`"
        >
          <UTextarea
            v-model="formStateRef.recommendation"
            :rows="6"
            :maxlength="TEXT_MAX_LENGTH"
            :disabled="readonly"
            class="w-full"
          />
        </UFormField>
        <StudentPhotoStrip
          :session="session"
          :student-id="formStateRef.studentId"
          :readonly="readonly"
        />
      </div>

      <div class="flex flex-col gap-3">
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
              :disabled="readonly"
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
        <div class="flex justify-between">
          <UButton
            type="button"
            label="Clear daily"
            color="neutral"
            variant="outline"
            size="lg"
            :disabled="readonly"
            @click="runUnlessUnsaved(resetForm)"
          />
          <div class="flex justify-end gap-2">
            <UButton
              type="submit"
              label="Save"
              color="neutral"
              variant="outline"
              size="lg"
              :disabled="readonly"
              @click="pendingActionRef = 'save'"
            />
            <UButton
              type="submit"
              label="Submit"
              icon="i-lucide-send"
              size="lg"
              :disabled="readonly"
              @click="pendingActionRef = 'submit'"
            />
          </div>
        </div>
      </div>
    </div>

    <UModal
      v-model:open="isUnsavedConfirmOpenRef"
      title="Unsaved changes"
      description="This student's data hasn't been saved and will be lost."
    >
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            type="button"
            label="Discard"
            color="error"
            variant="outline"
            @click="handleDiscardChanges"
          />
          <UButton
            type="button"
            label="Save"
            @click="handleSaveChanges"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="isBlankConfirmOpenRef"
      title="Leave fields blank?"
      description="Some fields are empty."
    >
      <template #body>
        <p class="text-sm">
          Submit without: <span class="font-medium">{{ blankFieldLabelListRef.join(", ") }}</span>
        </p>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            type="button"
            label="Go back"
            color="neutral"
            variant="outline"
            @click="isBlankConfirmOpenRef = false"
          />
          <UButton
            type="button"
            label="Submit anyway"
            @click="handleConfirmBlankSubmit"
          />
        </div>
      </template>
    </UModal>
  </UForm>
</template>
