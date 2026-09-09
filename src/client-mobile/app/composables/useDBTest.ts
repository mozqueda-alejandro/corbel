export function useDBTest() {
  async function clearUserAndClassData() {
    const database = useDatabase();
    await database.sessionTable.clear();
    await database.userTable.clear();
    await database.classTable.clear();
    await database.noteTable.clear();
    window.location.reload();
  }

  return { clearUserAndClassData };
}
