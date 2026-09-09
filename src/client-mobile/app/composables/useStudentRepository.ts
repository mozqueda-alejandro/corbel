import type { Student } from "~/schemas/student.schema";

// Module-level ref: acts as a shared singleton, same as a Dexie useLiveQuery
// result would be — every component consuming this composable sees the same
// reactive array instead of getting its own isolated copy.
const dummyStudentListRef = ref<Student[]>([
  { id: "10e5c49f-3f42-4627-b9e5-05ec921f1d6d", firstName: "Alonso", lastName: "Ramirez", status: "Active", year: 1 },
  { id: "b462bce3-8e16-496f-b18d-afdbdf6e7a09", firstName: "Mateo", lastName: "Alvarez", status: "Inactive", year: 2 }
]);

export function useStudentRepository() {
  // TODO: replace with:
  // const database = useDatabase()
  // const { data: studentListRef, error: studentListErrorRef } = useLiveQuery(
  //   () => database.studentTable.toArray(),
  //   []
  // )
  const studentListRef = dummyStudentListRef;

  function getStudentById(studentId: string) {
    return studentListRef.value.find(studentItem => studentItem.id === studentId);
  }

  return { studentListRef, getStudentById };
}
