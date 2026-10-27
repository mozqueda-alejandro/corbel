import { type Session, SessionStatusEnum } from "~/schemas/session.schema";
import { type SessionStudent, type Student, StudentStatusEnum } from "~/schemas/student.schema";
import type { TestVariant } from "~/schemas/test-variant.schema";
import { AutoArchiveUnitEnum, type UserSettings } from "~/schemas/user.schema";

export enum SessionTransitionEnum {
  Export = "Export",
  Complete = "Complete",
  RevertToDraft = "RevertToDraft",
  Archive = "Archive",
  Unarchive = "Unarchive"
}

const sessionTransitionRuleMap: Record<SessionTransitionEnum, { fromStatusList: SessionStatusEnum[], toStatus: SessionStatusEnum }> = {
  [SessionTransitionEnum.Export]: { fromStatusList: [SessionStatusEnum.Drafting, SessionStatusEnum.Exported], toStatus: SessionStatusEnum.Exported },
  [SessionTransitionEnum.Complete]: { fromStatusList: [SessionStatusEnum.Exported], toStatus: SessionStatusEnum.Completed },
  [SessionTransitionEnum.RevertToDraft]: { fromStatusList: [SessionStatusEnum.Completed], toStatus: SessionStatusEnum.Exported },
  [SessionTransitionEnum.Archive]: { fromStatusList: [SessionStatusEnum.Completed], toStatus: SessionStatusEnum.Archived },
  [SessionTransitionEnum.Unarchive]: { fromStatusList: [SessionStatusEnum.Archived], toStatus: SessionStatusEnum.Completed }
};

export const sessionTransitionDisplayMap: Record<SessionTransitionEnum, { label: string, icon: string, pastTense: string }> = {
  [SessionTransitionEnum.Export]: { label: "Export", icon: "i-lucide-upload", pastTense: "exported" },
  [SessionTransitionEnum.Complete]: { label: "Mark completed", icon: "i-lucide-circle-check", pastTense: "marked completed" },
  [SessionTransitionEnum.RevertToDraft]: { label: "Revert to draft", icon: "i-lucide-lock-open", pastTense: "reopened" },
  [SessionTransitionEnum.Archive]: { label: "Archive", icon: "i-lucide-archive", pastTense: "archived" },
  [SessionTransitionEnum.Unarchive]: { label: "Unarchive", icon: "i-lucide-archive-restore", pastTense: "unarchived" }
};

export function isSessionLocked(session: Pick<Session, "status">): boolean {
  return session.status === SessionStatusEnum.Completed || session.status === SessionStatusEnum.Archived;
}

export function canTransitionSession(session: Pick<Session, "status">, transition: SessionTransitionEnum): boolean {
  return sessionTransitionRuleMap[transition].fromStatusList.includes(session.status);
}

export function toSessionStudent(student: Student): SessionStudent {
  const { id, firstName, lastName, preferredName, status } = student;
  return { id, firstName, lastName, preferredName, status };
}

// Everyone who is active now, plus anyone the session already refers to, whatever their status.
export function buildSessionRoster(session: Session, studentList: Student[]): SessionStudent[] {
  const referencedStudentIdSet = new Set([
    ...session.attendance.map(record => record.studentId),
    ...session.dailies.map(record => record.studentId),
    ...session.tests.map(record => record.studentId),
    ...session.photos.map(photo => photo.studentId)
  ]);
  return studentList
    .filter(student => student.status === StudentStatusEnum.Active || referencedStudentIdSet.has(student.id))
    .map(toSessionStudent);
}

// studentList is only read the first time a session is completed, to freeze the roster.
export function applySessionTransition(session: Session, transition: SessionTransitionEnum, now = new Date(), studentList: Student[] = []): Session {
  if (!canTransitionSession(session, transition)) {
    throw new Error(`Cannot ${transition.toLowerCase()} a session that is ${session.status.toLowerCase()}.`);
  }

  const transitionedSession: Session = { ...session, status: sessionTransitionRuleMap[transition].toStatus };
  switch (transition) {
    case SessionTransitionEnum.Export:
      transitionedSession.exportedAt = now;
      break;
    case SessionTransitionEnum.Complete:
      transitionedSession.completedAt = now;
      // Only the first completion freezes the roster, so reopening a session can't change who was in it.
      transitionedSession.studentRoster = session.studentRoster ?? buildSessionRoster(session, studentList);
      break;
    case SessionTransitionEnum.RevertToDraft:
      transitionedSession.completedAt = undefined;
      transitionedSession.unarchivedAt = undefined;
      break;
    case SessionTransitionEnum.Archive:
      transitionedSession.archivedAt = now;
      break;
    case SessionTransitionEnum.Unarchive:
      transitionedSession.archivedAt = undefined;
      transitionedSession.unarchivedAt = now;
      break;
  }
  return transitionedSession;
}

// Editing an exported session makes the export stale, so it returns to drafting.
export function applySessionEdit(session: Session): Session {
  if (isSessionLocked(session)) throw new Error(`Session is ${session.status.toLowerCase()} and can't be edited.`);
  return session.status === SessionStatusEnum.Exported ? { ...session, status: SessionStatusEnum.Drafting } : session;
}

// Brings the session's copies of edited tests up to date, so its scores follow the new version. Scores for
// skills the test no longer has are dropped and the rest are held to the skill's new maximum.
// Returns the same session when no copy differs.
export function applyTestVariantUpdate(session: Session, testVariantById: Map<string, TestVariant>): Session {
  const copyList = session.testVariants ?? [];
  const changedIdSet = new Set(copyList
    .filter((copy) => {
      const updatedTestVariant = testVariantById.get(copy.id);
      return updatedTestVariant && JSON.stringify(updatedTestVariant) !== JSON.stringify(copy);
    })
    .map(copy => copy.id));
  if (changedIdSet.size === 0) return session;

  return applySessionEdit({
    ...session,
    testVariants: copyList.map(copy => (changedIdSet.has(copy.id) ? testVariantById.get(copy.id)! : copy)),
    tests: session.tests.map((testRecord) => {
      if (!changedIdSet.has(testRecord.testVariantId)) return testRecord;
      const skillById = new Map(testVariantById.get(testRecord.testVariantId)!.skills.map(skill => [skill.id, skill]));
      return {
        ...testRecord,
        skills: testRecord.skills
          .filter(skillScore => skillById.has(skillScore.skillId))
          .map(skillScore => ({ ...skillScore, score: Math.min(skillScore.score, skillById.get(skillScore.skillId)!.maxScore) }))
      };
    })
  });
}

export type SessionContent = Pick<Session, "name" | "overview" | "date" | "studentRoster" | "testVariants" | "attendance" | "dailies" | "tests" | "photos">;

export function pickSessionContent(session: SessionContent): SessionContent {
  return {
    name: session.name,
    overview: session.overview,
    date: session.date,
    studentRoster: session.studentRoster,
    testVariants: session.testVariants,
    attendance: session.attendance,
    dailies: session.dailies,
    tests: session.tests,
    photos: session.photos
  };
}

export function hasSessionContentChanged(storedSession: SessionContent, updatedSession: SessionContent): boolean {
  const normalizeContent = (session: SessionContent) => JSON.stringify({
    ...pickSessionContent(session),
    overview: session.overview ?? "",
    date: new Date(session.date).toISOString(),
    attendance: [...session.attendance].sort((recordA, recordB) => recordA.studentId.localeCompare(recordB.studentId))
  });
  return normalizeContent(storedSession) !== normalizeContent(updatedSession);
}

export function getSessionExportFileName(session: Pick<Session, "name" | "date">, extension: "json" | "zip" = "json"): string {
  const sessionDate = new Date(session.date);
  const dateStamp = `${sessionDate.getFullYear()}-${String(sessionDate.getMonth() + 1).padStart(2, "0")}-${String(sessionDate.getDate()).padStart(2, "0")}`;
  const nameSlug = session.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "session";
  // Default session names already contain the date.
  return nameSlug.includes(dateStamp) ? `${nameSlug}.${extension}` : `${nameSlug}-${dateStamp}.${extension}`;
}

export function getAutoArchiveThresholdDate(settings: UserSettings, now = new Date()): Date {
  const { amount, unit } = settings.autoArchive;
  const thresholdDate = new Date(now);
  if (unit === AutoArchiveUnitEnum.Days) thresholdDate.setDate(thresholdDate.getDate() - amount);
  else if (unit === AutoArchiveUnitEnum.Months) thresholdDate.setMonth(thresholdDate.getMonth() - amount);
  else thresholdDate.setFullYear(thresholdDate.getFullYear() - amount);
  return thresholdDate;
}

export function isSessionDueForAutoArchive(session: Session, settings: UserSettings, now = new Date()): boolean {
  if (!settings.autoArchive.enabled || session.status !== SessionStatusEnum.Completed || !session.completedAt) return false;

  const clockStartTime = Math.max(new Date(session.completedAt).getTime(), session.unarchivedAt ? new Date(session.unarchivedAt).getTime() : 0);
  return clockStartTime <= getAutoArchiveThresholdDate(settings, now).getTime();
}
