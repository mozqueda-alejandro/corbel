import { type Note, noteSchema } from "~/schemas/note.schema";
import { NoteColor } from "~/schemas/note.schema";

export function useNoteRepository() {
  const database = useDatabase();
  const { data: noteListRef, error: noteListErrorRef } = useLiveQuery(() => database.noteTable.toArray());

  function getNotesBySessionId(sessionId: string) {
    return computed(() => (noteListRef.value ?? []).filter(noteItem => noteItem.sessionId === sessionId));
  }

  // Notes belong to their session, so they're locked along with it.
  async function assertSessionUnlocked(sessionId: string) {
    const session = await database.sessionTable.get(sessionId);
    if (session && isSessionLocked(session)) throw new Error(`Session is ${session.status.toLowerCase()} and its notes can't be changed.`);
  }

  async function createNote(sessionId: string) {
    await assertSessionUnlocked(sessionId);
    const newNote: Note = {
      id: crypto.randomUUID(),
      sessionId,
      text: "Text",
      color: NoteColor.Neutral,
      tags: [],
      createdAt: new Date()
    };
    const validatedNote = noteSchema.parse(newNote);
    await database.noteTable.add(validatedNote);
    return validatedNote;
  }

  async function updateNote(noteData: Note) {
    const validatedNote = noteSchema.parse(noteData);
    await assertSessionUnlocked(validatedNote.sessionId);
    await database.noteTable.put(validatedNote);
  }

  async function deleteNote(noteId: string) {
    const storedNote = await database.noteTable.get(noteId);
    if (storedNote) await assertSessionUnlocked(storedNote.sessionId);
    await database.noteTable.delete(noteId);
  }

  return { noteListRef, noteListErrorRef, getNotesBySessionId, createNote, updateNote, deleteNote };
}
