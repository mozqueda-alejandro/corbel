// ~/composables/useSessionRepository.ts
import {
  MAX_PHOTOS_PER_STUDENT,
  type Session,
  sessionSchema,
  SessionStatusEnum
} from "~/schemas/session.schema";
import { defaultUserSettings, type UserSettings } from "~/schemas/user.schema";
import { saveFile, saveJsonFile } from "~/utils/saveFile";

export function useSessionRepository() {
  const database = useDatabase();

  const { data: sessionListRef, error: sessionListErrorRef } = useLiveQuery(() => database.sessionTable.toArray());

  // Only for creating sessions; changes to existing sessions go through saveSessionEdit or transitionSession.
  async function saveSession(sessionData: Session) {
    const validatedSession = sessionSchema.parse(sessionData);
    await database.sessionTable.put(validatedSession);
  }

  // Reads the stored session inside a transaction so status rules are checked against the latest data.
  async function updateStoredSession(sessionId: string, updateFn: (storedSession: Session) => Session) {
    return database.transaction("rw", database.sessionTable, database.photoTable, async () => {
      const storedSession = await database.sessionTable.get(sessionId);
      if (!storedSession) throw new Error("Session not found.");

      const updatedSession = updateFn(storedSession);
      if (updatedSession === storedSession) return storedSession;

      const validatedSession = sessionSchema.parse(updatedSession);
      await database.sessionTable.put(validatedSession);
      return validatedSession;
    });
  }

  async function saveSessionEdit(sessionId: string, sessionContent: Partial<SessionContent>) {
    return updateStoredSession(sessionId, (storedSession) => {
      const editedSession = { ...storedSession, ...sessionContent };
      if (!hasSessionContentChanged(storedSession, editedSession)) return storedSession;
      return applySessionEdit(editedSession);
    });
  }

  // Returns how many photos were added; anything beyond the per-student limit is dropped.
  async function addSessionPhotoList(sessionId: string, studentId: string, photoBlobList: Blob[]) {
    // Bytes are read before the transaction opens, since a transaction can't await non-Dexie promises.
    const photoDataList = await Promise.all(photoBlobList.map(async (blob) => {
      const data = await blob.arrayBuffer();
      if (data.byteLength === 0) throw new Error("A photo was empty and couldn't be saved.");
      return { data, type: blob.type || "image/jpeg" };
    }));

    return database.transaction("rw", database.sessionTable, database.photoTable, async () => {
      const storedSession = await database.sessionTable.get(sessionId);
      if (!storedSession) throw new Error("Session not found.");

      const storedPhotoCount = storedSession.photos.filter(photo => photo.studentId === studentId).length;
      const acceptedDataList = photoDataList.slice(0, Math.max(0, MAX_PHOTOS_PER_STUDENT - storedPhotoCount));
      if (acceptedDataList.length === 0) return 0;

      const createdAt = new Date();
      const newPhotoList = acceptedDataList.map(({ data, type }) => ({ id: crypto.randomUUID(), sessionId, studentId, data, type, createdAt }));

      // Updated first so a locked session throws before any image is written.
      await updateStoredSession(sessionId, session => applySessionEdit({
        ...session,
        photos: [...session.photos, ...newPhotoList.map(({ id, studentId: photoStudentId, createdAt: photoCreatedAt }) =>
          ({ id, studentId: photoStudentId, createdAt: photoCreatedAt, tags: [] }))]
      }));
      await database.photoTable.bulkPut(newPhotoList);
      return newPhotoList.length;
    });
  }

  async function updateSessionPhotoTagList(sessionId: string, photoId: string, tagList: string[]) {
    return updateStoredSession(sessionId, session => applySessionEdit({
      ...session,
      photos: session.photos.map(photo => (photo.id === photoId ? { ...photo, tags: tagList } : photo))
    }));
  }

  async function deleteSessionPhoto(sessionId: string, photoId: string) {
    await database.transaction("rw", database.sessionTable, database.photoTable, async () => {
      await updateStoredSession(sessionId, session => applySessionEdit({
        ...session,
        photos: session.photos.filter(photo => photo.id !== photoId)
      }));
      await database.photoTable.delete(photoId);
    });
  }

  async function transitionSession(sessionId: string, transition: SessionTransitionEnum) {
    return updateStoredSession(sessionId, storedSession => applySessionTransition(storedSession, transition));
  }

  // A session with photos is exported as a zip of session.json and its images, otherwise as plain JSON.
  async function saveSessionExportFile(session: Session) {
    const photoList = await database.photoTable.where("sessionId").equals(session.id).toArray();
    if (photoList.length === 0) return saveJsonFile(getSessionExportFileName(session), session);

    const archiveBlob = await createSessionArchive(session, photoList);
    return saveFile(getSessionExportFileName(session, "zip"), archiveBlob, {
      description: "Zip archive",
      mimeType: "application/zip",
      extension: ".zip"
    });
  }

  // Returns undefined if the user cancelled the save, leaving the status unchanged.
  async function exportSession(sessionId: string) {
    const storedSession = await database.sessionTable.get(sessionId);
    if (!storedSession) throw new Error("Session not found.");
    if (!canTransitionSession(storedSession, SessionTransitionEnum.Export)) {
      throw new Error(`Cannot export a session that is ${storedSession.status.toLowerCase()}.`);
    }

    const isSaved = await saveSessionExportFile(storedSession);
    if (!isSaved) return undefined;
    return transitionSession(sessionId, SessionTransitionEnum.Export);
  }

  async function archiveDueSessions(settings: UserSettings = defaultUserSettings) {
    const now = new Date();
    const completedSessionList = await database.sessionTable.filter(sessionItem => sessionItem.status === SessionStatusEnum.Completed).toArray();
    const dueSessionList = completedSessionList.filter(sessionItem => isSessionDueForAutoArchive(sessionItem, settings, now));
    if (dueSessionList.length === 0) return 0;

    await database.sessionTable.bulkPut(dueSessionList.map(sessionItem => applySessionTransition(sessionItem, SessionTransitionEnum.Archive, now)));
    return dueSessionList.length;
  }

  async function deleteSession(sessionId: string) {
    await database.transaction("rw", database.sessionTable, database.photoTable, async () => {
      const storedSession = await database.sessionTable.get(sessionId);
      if (storedSession && isSessionLocked(storedSession)) throw new Error(`Session is ${storedSession.status.toLowerCase()} and can't be deleted.`);
      await database.sessionTable.delete(sessionId);
      await database.photoTable.where("sessionId").equals(sessionId).delete();
    });
  }

  async function getSessionById(sessionId: string) {
    return database.sessionTable.get(sessionId);
  }

  return {
    sessionListRef,
    sessionListErrorRef,
    saveSession,
    saveSessionEdit,
    addSessionPhotoList,
    updateSessionPhotoTagList,
    deleteSessionPhoto,
    transitionSession,
    exportSession,
    archiveDueSessions,
    deleteSession,
    getSessionById
  };
}
