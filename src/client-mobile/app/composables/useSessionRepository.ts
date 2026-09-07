import { type Session, sessionSchema } from "~/schemas/session.schema";

export function useSessionRepository() {
  const database = useDatabase();

  const { data: sessionListRef, error: sessionListErrorRef } = useLiveQuery(
    () => database.sessionTable.toArray(),
    []
  );

  async function getSessionById(id: string): Promise<Session | undefined> {
    return database.sessionTable.get(id);
  }

  async function saveSession(sessionData: Session) {
    const validatedSession = sessionSchema.parse(sessionData);
    await database.sessionTable.put(validatedSession);
  }

  async function deleteSession(sessionId: string) {
    await database.sessionTable.delete(sessionId);
  }

  return { sessionListRef, sessionListErrorRef, getSessionById, saveSession, deleteSession };
}
