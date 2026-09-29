export function useStudentRepository() {
  const database = useDatabase();

  const { data: studentListRef, error: studentListErrorRef } = useLiveQuery(() => database.studentTable.toArray());

  function getStudentById(id: string) {
    return database.studentTable.get(id);
  }

  return { studentListRef, getStudentById };
}
