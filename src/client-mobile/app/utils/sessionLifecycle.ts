import { type Session, SessionStatusEnum } from "~/schemas/session.schema";
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

export function applySessionTransition(session: Session, transition: SessionTransitionEnum, now = new Date()): Session {
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

export type SessionContent = Pick<Session, "name" | "overview" | "date" | "studentRoster" | "attendance" | "dailies" | "tests" | "photos">;

export function pickSessionContent(session: SessionContent): SessionContent {
  return {
    name: session.name,
    overview: session.overview,
    date: session.date,
    studentRoster: session.studentRoster,
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
