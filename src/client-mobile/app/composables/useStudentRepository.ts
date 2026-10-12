import { type Student, studentSchema } from "~/schemas/student.schema";

export function useStudentRepository() {
  const database = useDatabase();

  const { data: studentListRef, error: studentListErrorRef } = useLiveQuery(() => database.studentTable.toArray());

  function getStudentById(id: string) {
    return database.studentTable.get(id);
  }

  async function saveStudent(studentData: Student) {
    const validatedStudent = studentSchema.parse(studentData);
    await database.studentTable.put(validatedStudent);
  }

  return { studentListRef, studentListErrorRef, getStudentById, saveStudent };
}
