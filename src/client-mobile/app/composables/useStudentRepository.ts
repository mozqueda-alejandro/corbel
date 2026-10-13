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

  // Validates every student first so a bad row can't leave a partial import behind.
  async function saveStudentList(studentList: Student[]) {
    const validatedStudentList = studentList.map(studentItem => studentSchema.parse(studentItem));
    await database.studentTable.bulkPut(validatedStudentList);
  }

  async function deleteStudentList(studentIdList: string[]) {
    await database.studentTable.bulkDelete(studentIdList);
  }

  return { studentListRef, studentListErrorRef, getStudentById, saveStudent, saveStudentList, deleteStudentList };
}
