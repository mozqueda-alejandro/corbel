import { type Note, noteSchema } from "~/schemas/note.schema";
import { NoteColor } from "~/schemas/note.schema";

export function useNoteRepository() {
  const database = useDatabase();
  const { data: noteListRef, error: noteListErrorRef } = useLiveQuery(() => database.noteTable.toArray());

  function getNotesBySessionId(sessionId: string) {
    return computed(() => (noteListRef.value ?? []).filter(noteItem => noteItem.sessionId === sessionId));
  }

  async function createNote(sessionId: string) {
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
    await database.noteTable.put(validatedNote);
  }

  async function deleteNote(noteId: string) {
    await database.noteTable.delete(noteId);
  }

  return { noteListRef, noteListErrorRef, getNotesBySessionId, createNote, updateNote, deleteNote };
}
