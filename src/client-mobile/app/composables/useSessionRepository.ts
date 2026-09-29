// ~/composables/useSessionRepository.ts
import { type Session, sessionSchema } from "~/schemas/session.schema";

export function useSessionRepository() {
  const database = useDatabase();

  const { data: sessionListRef, error: sessionListErrorRef } = useLiveQuery(() => database.sessionTable.toArray());

  async function saveSession(sessionData: Session) {
    const validatedSession = sessionSchema.parse(sessionData);
    await database.sessionTable.put(validatedSession);
  }

  async function deleteSession(sessionId: string) {
    await database.sessionTable.delete(sessionId);
  }

  async function getSessionById(sessionId: string) {
    return database.sessionTable.get(sessionId);
  }

  return { sessionListRef, sessionListErrorRef, saveSession, deleteSession, getSessionById };
}
